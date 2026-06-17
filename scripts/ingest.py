"""
Ingestion quotidienne : prix de la dernière clôture + snapshots pour les 3 portefeuilles.
Calcule aussi les snapshots rétroactifs pour toutes les dates en base sans snapshot.

Usage : python scripts/ingest.py
Idempotent — upsert partout. Jamais de snapshot partiel (tout ou rien par upsert atomique).
"""

import logging
import os
import sys
from datetime import date
from math import sqrt

import pandas as pd
from dotenv import load_dotenv
from supabase import create_client, Client

from market_data import fetch_ohlcv, last_close_date

load_dotenv(dotenv_path="../.env.local")
load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
logger = logging.getLogger(__name__)

TICKERS = [
    "GOOGL", "IBM", "NVDA", "IONQ", "QBTS", "LAES", "INFQ",
    "RGTI", "QUBT", "QNT",            # suivi sectoriel pur — hors portefeuilles (migration 005)
    "XNDU", "ARQQ", "HQ",             # suivi sectoriel pur — hors portefeuilles (migration 006)
    "QNTM.L", "QQQ",                   # benchmarks graphique comparatif
]

# Tickers dont l'IPO est postérieure à l'inception (01/06/2026).
# Exclus du fetch avant leur première cotation — pas d'erreur, pas de ligne fantôme.
TICKER_FIRST_TRADE: dict[str, date] = {
    "QNT": date(2026, 6, 4),  # IPO Nasdaq — premier cours le 04/06/2026
}

INITIAL_CAPITAL_USD = 10_000.0
BATCH_SIZE = 500


def _active_tickers(close_date: date) -> list[str]:
    """Filtre les tickers pré-IPO pour close_date (retourne TICKERS si hors contrainte)."""
    return [t for t in TICKERS if close_date >= TICKER_FIRST_TRADE.get(t, date.min)]


# ─── Supabase ────────────────────────────────────────────────────────────────

def _supabase_client() -> Client:
    return create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_KEY"])


def _upsert_batched(db: Client, table: str, rows: list[dict]) -> None:
    for i in range(0, len(rows), BATCH_SIZE):
        db.table(table).upsert(rows[i : i + BATCH_SIZE]).execute()


# ─── Ingestion des prix ───────────────────────────────────────────────────────

def ingest_prices(db: Client, close_date: date) -> bool:
    """
    Récupère les prix de clôture pour close_date et les insère dans price_daily.
    Retourne False si aucune cotation n'existe pour cette date (jour férié US),
    True si l'ingestion a réussi.
    Lève RuntimeError en cas d'échec réseau (→ exit 1 dans main).
    """
    logger.info("Téléchargement des prix pour le %s…", close_date)
    try:
        ohlcv = fetch_ohlcv(_active_tickers(close_date), start=close_date, end=close_date)
    except ValueError as exc:
        logger.warning("Aucune cotation le %s — jour férié US ? (%s)", close_date, exc)
        return False
    # RuntimeError (échec réseau après retries) remonte jusqu'à main → exit 1

    rows_price: list[dict] = []
    for ticker, df in ohlcv.items():
        if df.empty:
            logger.error("Données vides pour %s — ingestion interrompue.", ticker)
            sys.exit(1)
        for dt, row in df.iterrows():
            vol = row["volume"]
            rows_price.append({
                "ticker":    ticker,
                "date":      str(dt)[:10],
                "close":     round(float(row["close"]), 6),
                "adj_close": round(float(row["adj_close"]), 6),
                "volume":    int(vol) if pd.notna(vol) else None,
            })

    logger.info("Upsert de %d lignes dans price_daily…", len(rows_price))
    _upsert_batched(db, "price_daily", rows_price)
    return True


# ─── Chargement depuis la base ────────────────────────────────────────────────

def _load_prices(db: Client) -> pd.DataFrame:
    """DataFrame (index=date, colonnes=tickers, valeurs=adj_close)."""
    res = db.table("price_daily").select("ticker, date, adj_close").limit(50_000).execute()
    if not res.data:
        return pd.DataFrame()
    df = pd.DataFrame(res.data)
    df["date"] = pd.to_datetime(df["date"]).dt.date
    df["adj_close"] = df["adj_close"].astype(float)
    return df.pivot(index="date", columns="ticker", values="adj_close")


def _load_positions(db: Client) -> dict[str, dict[str, float]]:
    """{portfolio_id: {ticker: total_quantity}} — agrège les comptes (ex. GOOGL CTO + PER)."""
    res = db.table("position").select("portfolio_id, ticker, quantity").execute()
    positions: dict[str, dict[str, float]] = {}
    for row in res.data:
        pid = row["portfolio_id"]
        ticker = row["ticker"]
        positions.setdefault(pid, {})
        positions[pid][ticker] = positions[pid].get(ticker, 0.0) + float(row["quantity"])
    return positions


def _load_initial_capitals(db: Client) -> dict[str, float]:
    """{portfolio_id: initial_capital_usd} — lu depuis la table portfolio."""
    res = db.table("portfolio").select("id, initial_capital_usd").execute()
    return {row["id"]: float(row["initial_capital_usd"]) for row in res.data}


# ─── Calcul des snapshots ─────────────────────────────────────────────────────

def compute_snapshots(
    positions: dict[str, dict[str, float]],
    prices: pd.DataFrame,
    initial_capitals: dict[str, float],
) -> list[dict]:
    """
    Calcule value_usd, perf_cumul, vol_30d/90j (annualisées), max_drawdown
    pour chaque (portfolio_id, date) où toutes les données sont disponibles.
    Utilise initial_capitals[portfolio_id] pour perf_cumul (capital propre à chaque portefeuille).
    Lève RuntimeError si un ticker requis est absent de price_daily.
    """
    rows: list[dict] = []

    for pid, pos in positions.items():
        tickers = list(pos.keys())
        initial = initial_capitals.get(pid, INITIAL_CAPITAL_USD)

        missing_tickers = [t for t in tickers if t not in prices.columns]
        if missing_tickers:
            raise RuntimeError(
                f"Portefeuille {pid} : tickers absents de price_daily : {missing_tickers}"
            )

        # Dates avec données complètes pour ce portefeuille
        mask = prices[tickers].notna().all(axis=1)
        valid_dates = prices.index[mask]
        if len(valid_dates) == 0:
            logger.warning("Aucune date valide pour le portefeuille %s.", pid)
            continue

        # Série de valeur USD : Σ(qty_i × adj_close_i)
        sub = prices.loc[valid_dates, tickers]
        qty = pd.Series({t: pos[t] for t in tickers})
        value_usd = sub.dot(qty).sort_index()

        perf_cumul   = value_usd / initial - 1.0
        daily_ret    = value_usd.pct_change()
        vol_30d      = daily_ret.rolling(30, min_periods=30).std() * sqrt(252)
        vol_90d      = daily_ret.rolling(90, min_periods=90).std() * sqrt(252)
        running_peak = value_usd.cummax()
        max_dd       = (value_usd / running_peak - 1.0).cummin()

        for dt in valid_dates:
            v30 = vol_30d[dt]
            v90 = vol_90d[dt]
            rows.append({
                "portfolio_id": pid,
                "date":         str(dt),
                "value_usd":    round(float(value_usd[dt]), 4),
                "perf_cumul":   round(float(perf_cumul[dt]), 8),
                "vol_30d":      None if pd.isna(v30) else round(float(v30), 8),
                "vol_90d":      None if pd.isna(v90) else round(float(v90), 8),
                "max_drawdown": round(float(max_dd[dt]), 8),
            })

    return rows


# ─── Market caps (log uniquement, rien stocké) ───────────────────────────────

def _log_market_caps(db: Client, close_date: date) -> None:
    """
    Calcule et affiche les market caps dans les logs. Rien n'est écrit en base.
    market_cap_usd = shares_outstanding (le plus récent) × adj_close du jour.
    Agrégat pure-players calculé sur category = 'pure_player' uniquement.
    Si shares_outstanding est vide ou absent, log un avertissement et continue.
    """
    try:
        shares_res = db.table("shares_outstanding") \
            .select("ticker, shares, as_of_date") \
            .execute()
        if not shares_res.data:
            logger.info("shares_outstanding vide — market caps non calculées.")
            return

        # Dernière ligne par ticker (ORDER BY as_of_date DESC en Python)
        latest_shares: dict[str, dict] = {}
        for row in shares_res.data:
            t = row["ticker"]
            if t not in latest_shares or row["as_of_date"] > latest_shares[t]["as_of_date"]:
                latest_shares[t] = row

        # Prix du jour
        prices_res = db.table("price_daily") \
            .select("ticker, adj_close") \
            .eq("date", str(close_date)) \
            .execute()
        prices = {r["ticker"]: float(r["adj_close"]) for r in (prices_res.data or [])}

        # Catégories
        assets_res = db.table("asset") \
            .select("ticker, category") \
            .in_("ticker", list(latest_shares.keys())) \
            .execute()
        categories = {r["ticker"]: r["category"] for r in (assets_res.data or [])}

        logger.info("─── Market caps au %s ───", close_date)
        pure_player_total = 0.0
        for ticker in sorted(latest_shares):
            price = prices.get(ticker)
            if price is None:
                logger.info("  %-6s  cours manquant pour le %s", ticker, close_date)
                continue
            mcap = latest_shares[ticker]["shares"] * price
            cat = categories.get(ticker, "?")
            logger.info(
                "  %-6s  %8.2f G$  [%-14s]  %s M actions  (source: %s)",
                ticker, mcap / 1e9, cat,
                f"{latest_shares[ticker]['shares'] // 1_000_000:,}",
                latest_shares[ticker]["as_of_date"],
            )
            if cat == "pure_player":
                pure_player_total += mcap

        if pure_player_total > 0:
            logger.info("  TOTAL pure-players : %.2f G$", pure_player_total / 1e9)

    except Exception as exc:
        logger.warning("Market caps non calculées (shares_outstanding absent ?) : %s", exc)


# ─── Main ─────────────────────────────────────────────────────────────────────

def main() -> None:
    close_date = last_close_date()
    logger.info("=== Ingestion du %s ===", close_date)

    db = _supabase_client()

    # 1. Prix du jour
    has_new_prices = ingest_prices(db, close_date)
    if not has_new_prices:
        logger.info("Pas de nouveau prix — pas de nouvelle clôture à ingérer.")

    # 2. Chargement de toutes les données de la base
    logger.info("Chargement des données de la base…")
    prices           = _load_prices(db)
    positions        = _load_positions(db)
    initial_capitals = _load_initial_capitals(db)

    if prices.empty:
        logger.error("price_daily vide — impossible de calculer les snapshots.")
        sys.exit(1)

    if not positions:
        logger.error("Aucune position en base — seed non exécuté ?")
        sys.exit(1)

    # 3. Calcul de tous les snapshots (rétroactif + nouveau jour)
    logger.info(
        "Calcul des snapshots pour %d portefeuilles × %d dates disponibles…",
        len(positions), len(prices.index),
    )
    try:
        snapshot_rows = compute_snapshots(positions, prices, initial_capitals)
    except RuntimeError as exc:
        logger.error("Erreur de calcul des snapshots : %s", exc)
        sys.exit(1)

    if not snapshot_rows:
        logger.warning("Aucun snapshot calculé.")
        sys.exit(0)

    # 4. Upsert atomique (tout ou rien par requête)
    logger.info("Upsert de %d lignes dans snapshot_daily…", len(snapshot_rows))
    _upsert_batched(db, "snapshot_daily", snapshot_rows)

    # 5. Market caps (log uniquement — shares × adj_close, rien stocké)
    _log_market_caps(db, close_date)

    logger.info("=== Ingestion terminée. ===")


if __name__ == "__main__":
    main()
