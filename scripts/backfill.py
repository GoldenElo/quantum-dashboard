"""
Backfill des prix (price_daily) depuis l'inception jusqu'à la dernière clôture disponible.

Usage : python scripts/backfill.py
Idempotent — upsert partout. Ne crée aucune ligne pour les jours sans cotation.
"""

import logging
import os
import sys
from datetime import date

import pandas as pd
from dotenv import load_dotenv
from supabase import create_client, Client

from market_data import fetch_ohlcv, last_close_date

load_dotenv(dotenv_path="../.env.local")
load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
logger = logging.getLogger(__name__)

INCEPTION_DATE = date(2026, 6, 1)
TICKERS = [
    "GOOGL", "IBM", "NVDA", "IONQ", "QBTS", "LAES", "INFQ",
    "RGTI", "QUBT", "QNT",            # suivi sectoriel pur — hors portefeuilles (migration 005)
    "XNDU", "ARQQ", "HQ",             # suivi sectoriel pur — hors portefeuilles (migration 006)
    "QNTM.L", "QQQ",                   # benchmarks
]

# Tickers dont l'IPO est postérieure à INCEPTION_DATE.
# yfinance retourne naturellement les dates depuis la première cotation — pas de ligne fantôme.
# Utilisé dans print_control_table pour ne pas signaler le manque de jours pre-IPO comme erreur.
TICKER_FIRST_TRADE: dict[str, date] = {
    "QNT": date(2026, 6, 4),  # IPO Nasdaq — premier cours le 04/06/2026
}

BATCH_SIZE = 500


def _supabase_client() -> Client:
    url = os.environ["SUPABASE_URL"]
    key = os.environ["SUPABASE_SERVICE_KEY"]
    return create_client(url, key)


def _upsert_batched(db: Client, table: str, rows: list[dict]) -> None:
    for i in range(0, len(rows), BATCH_SIZE):
        db.table(table).upsert(rows[i : i + BATCH_SIZE]).execute()


def backfill_prices(db: Client, start: date, end: date) -> dict[str, dict]:
    logger.info(
        "Téléchargement OHLCV %s → %s pour : %s",
        start, end, ", ".join(TICKERS),
    )
    ohlcv = fetch_ohlcv(TICKERS, start=start, end=end)

    rows: list[dict] = []
    stats: dict[str, dict] = {}
    for ticker, df in ohlcv.items():
        if df.empty:
            logger.error("Données vides pour %s — backfill interrompu.", ticker)
            sys.exit(1)
        stats[ticker] = {
            "count": len(df),
            "first": df.index.min(),
            "last":  df.index.max(),
        }
        for dt, row in df.iterrows():
            vol = row["volume"]
            rows.append({
                "ticker":    ticker,
                "date":      str(dt)[:10],
                "close":     round(float(row["close"]), 6),
                "adj_close": round(float(row["adj_close"]), 6),
                "volume":    int(vol) if pd.notna(vol) else None,
            })

    logger.info("Upsert de %d lignes dans price_daily…", len(rows))
    _upsert_batched(db, "price_daily", rows)
    logger.info("price_daily : OK")
    return stats



def print_control_table(price_stats: dict[str, dict]) -> None:
    ticker_counts = [v["count"] for v in price_stats.values()]
    ref = max(ticker_counts) if ticker_counts else 0

    W = 68
    print()
    print("─" * W)
    print(f"  {'Ticker':<12} {'Lignes':>7}  {'Première date':<13} {'Dernière date':<13} Statut")
    print("─" * W)

    for ticker in TICKERS:
        if ticker not in price_stats:
            print(f"  {ticker:<12} {'N/A':>7}  {'—':<13} {'—':<13} ⚠ ABSENT")
            continue
        v = price_stats[ticker]
        gap = ref - v["count"]
        if gap == 0:
            status = "OK"
        elif ticker in TICKER_FIRST_TRADE:
            status = f"OK (IPO {TICKER_FIRST_TRADE[ticker]}, {gap}j attendus)"
        else:
            status = f"⚠  {gap} lignes de moins"
        print(
            f"  {ticker:<12} {v['count']:>7}  {str(v['first']):<13} {str(v['last']):<13} {status}"
        )

    print("─" * W)
    print()

    real_gaps = {
        t: ref - v["count"]
        for t, v in price_stats.items()
        if ref - v["count"] > 0 and t not in TICKER_FIRST_TRADE
    }
    if real_gaps:
        logger.warning(
            "Incohérence détectée : %s",
            ", ".join(f"{t} ({g} lignes de moins)" for t, g in real_gaps.items()),
        )
    else:
        logger.info("Contrôle : cohérence vérifiée (%d lignes de référence).", ref)


def main() -> None:
    db = _supabase_client()
    end = last_close_date()
    price_stats = backfill_prices(db, start=INCEPTION_DATE, end=end)
    print_control_table(price_stats)


if __name__ == "__main__":
    main()
