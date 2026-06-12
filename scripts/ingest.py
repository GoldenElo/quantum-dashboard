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

TICKERS = ["GOOGL", "IBM", "NVDA", "IONQ", "QBTS", "LAES", "INFQ", "QNTM.L"]
INITIAL_CAPITAL_USD = 10_000.0
BATCH_SIZE = 500


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
        ohlcv = fetch_ohlcv(TICKERS, start=close_date, end=close_date)
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


# ─── Calcul des snapshots ─────────────────────────────────────────────────────

def compute_snapshots(
    positions: dict[str, dict[str, float]],
    prices: pd.DataFrame,
) -> list[dict]:
    """
    Calcule value_usd, perf_cumul, vol_30d/90j (annualisées), max_drawdown
    pour chaque (portfolio_id, date) où toutes les données sont disponibles.
    Lève RuntimeError si un ticker requis est absent de price_daily.
    """
    rows: list[dict] = []

    for pid, pos in positions.items():
        tickers = list(pos.keys())

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

        perf_cumul   = value_usd / INITIAL_CAPITAL_USD - 1.0
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
    prices    = _load_prices(db)
    positions = _load_positions(db)

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
        snapshot_rows = compute_snapshots(positions, prices)
    except RuntimeError as exc:
        logger.error("Erreur de calcul des snapshots : %s", exc)
        sys.exit(1)

    if not snapshot_rows:
        logger.warning("Aucun snapshot calculé.")
        sys.exit(0)

    # 4. Upsert atomique (tout ou rien par requête)
    logger.info("Upsert de %d lignes dans snapshot_daily…", len(snapshot_rows))
    _upsert_batched(db, "snapshot_daily", snapshot_rows)
    logger.info("=== Ingestion terminée. ===")


if __name__ == "__main__":
    main()
