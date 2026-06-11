"""
Backfill des prix (price_daily) et du taux EUR/USD (fx_rate)
depuis l'inception jusqu'à la dernière clôture disponible.

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

from market_data import fetch_ohlcv, fetch_eurusd, last_close_date

load_dotenv(dotenv_path="../.env.local")
load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
logger = logging.getLogger(__name__)

INCEPTION_DATE = date(2026, 6, 1)
TICKERS = ["GOOGL", "IBM", "NVDA", "IONQ", "QBTS", "LAES", "INFQ", "QTUM"]
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


def backfill_fx(db: Client, start: date, end: date) -> dict[str, dict]:
    logger.info("Téléchargement EUR/USD %s → %s…", start, end)
    series = fetch_eurusd(start=start, end=end)

    if series.empty:
        logger.error("Données EUR/USD vides — backfill interrompu.")
        sys.exit(1)

    rows = [
        {"pair": "EURUSD", "date": str(dt)[:10], "rate": round(float(rate), 6)}
        for dt, rate in series.items()
        if pd.notna(rate)
    ]
    logger.info("Upsert de %d lignes dans fx_rate…", len(rows))
    _upsert_batched(db, "fx_rate", rows)
    logger.info("fx_rate : OK")

    return {
        "EURUSD": {
            "count": len(rows),
            "first": series.index.min(),
            "last":  series.index.max(),
        }
    }


def print_control_table(
    price_stats: dict[str, dict],
    fx_stats: dict[str, dict],
) -> None:
    ticker_counts = [v["count"] for v in price_stats.values()]
    ref = max(ticker_counts) if ticker_counts else 0

    W = 68
    print()
    print("─" * W)
    print(f"  {'Ticker/Paire':<12} {'Lignes':>7}  {'Première date':<13} {'Dernière date':<13} Statut")
    print("─" * W)

    for ticker in TICKERS:
        if ticker not in price_stats:
            print(f"  {ticker:<12} {'N/A':>7}  {'—':<13} {'—':<13} ⚠ ABSENT")
            continue
        v = price_stats[ticker]
        gap = ref - v["count"]
        status = f"⚠  {gap} lignes de moins" if gap > 0 else "OK"
        print(
            f"  {ticker:<12} {v['count']:>7}  {str(v['first']):<13} {str(v['last']):<13} {status}"
        )

    print("─" * W)
    for key, v in fx_stats.items():
        print(
            f"  {key:<12} {v['count']:>7}  {str(v['first']):<13} {str(v['last']):<13} OK"
        )
    print("─" * W)
    print()

    gaps = {t: ref - v["count"] for t, v in price_stats.items() if ref - v["count"] > 0}
    if gaps:
        logger.warning(
            "Incohérence détectée : %s",
            ", ".join(f"{t} ({g} lignes de moins)" for t, g in gaps.items()),
        )
    else:
        logger.info("Contrôle : tous les tickers ont le même nombre de lignes (%d).", ref)


def main() -> None:
    db = _supabase_client()
    end = last_close_date()
    price_stats = backfill_prices(db, start=INCEPTION_DATE, end=end)
    fx_stats    = backfill_fx(db, start=INCEPTION_DATE, end=end)
    print_control_table(price_stats, fx_stats)


if __name__ == "__main__":
    main()
