"""
Backfill historique sectoriel — étend price_daily EN AMONT du 1er juin 2026
pour les 12 tickers de l'univers sectoriel, UNIQUEMENT pour le calcul des
variations multi-horizons du panorama (S2).

⚠️  Ce script NE touche PAS aux portefeuilles, à leur inception (1er juin 2026)
    ni à leurs courbes base 100 :
      - il ne backfille QUE les 12 tickers sectoriels (pas NVDA, pas les benchmarks
        QNTM.L / QQQ → leurs premiers prix restent au 1er juin) ;
      - le garde-fou inception de ingest.py empêche tout snapshot portefeuille
        avant son inception, même si des prix antérieurs existent désormais en base.

Usage : cd scripts && python3 backfill_sectoral.py
Idempotent — upsert partout. Aucune ligne pour les jours sans cotation.
Pour les IPO récentes (QNT, XNDU, HQ…), yfinance ne renvoie que depuis la 1re
cotation — aucune donnée inventée, aucune ligne fantôme.
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

# ~1 an avant l'inception des portefeuilles. DISTINCT de INCEPTION_DATE (2026-06-01).
SECTORAL_HISTORY_START = date(2025, 6, 1)

# Les 13 sociétés de l'univers sectoriel — SANS NVDA (infra) ni benchmarks (QNTM.L, QQQ).
SECTORAL_TICKERS = [
    "GOOGL", "IBM", "IONQ", "QBTS", "LAES", "INFQ",
    "RGTI", "QUBT", "QNT", "XNDU", "ARQQ", "HQ", "IQMX",
]

# ─── Garde-fou historique fantôme (sociétés issues d'une fusion SPAC) ─────────
# Pour un ticker né d'une fusion SPAC, yfinance sert SOUS LE NOUVEAU TICKER
# l'historique de cotation de la coquille SPAC pré-fusion (cours de trust ~10 $).
# Ces cours ne sont PAS ceux de la société : les importer fabriquerait une fausse
# profondeur d'historique et des variations multi-horizons mensongères.
#
# Toute date STRICTEMENT ANTÉRIEURE à la borne ci-dessous est écartée à l'écriture.
# Conséquence assumée et correcte : historique court → variations Mois/Année à null
# ("—" à l'affichage), comme pour toute IPO récente. On préfère l'absence au faux.
#
# IQMX : fusion avec Real Asset Acquisition Corp. (RAAQ), closing 01/07/2026 ;
#        cotation des ADS le 02/07/2026 (6-K SEC du 01/07/2026).
SECTORAL_FIRST_TRADE: dict[str, date] = {
    "IQMX": date(2026, 7, 2),
}

# Seuil "année complète" : 252 séances ≈ 1 an de cotation.
_FULL_YEAR_SESSIONS = 252
BATCH_SIZE = 500


def _supabase_client() -> Client:
    return create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_KEY"])


def _upsert_batched(db: Client, table: str, rows: list[dict]) -> None:
    for i in range(0, len(rows), BATCH_SIZE):
        db.table(table).upsert(rows[i : i + BATCH_SIZE]).execute()


def backfill_sectoral(db: Client, start: date, end: date) -> dict[str, dict]:
    logger.info(
        "Backfill sectoriel %s → %s pour : %s",
        start, end, ", ".join(SECTORAL_TICKERS),
    )
    ohlcv = fetch_ohlcv(SECTORAL_TICKERS, start=start, end=end)

    rows: list[dict] = []
    stats: dict[str, dict] = {}
    for ticker, df in ohlcv.items():
        if df.empty:
            logger.error("Données vides pour %s — backfill interrompu.", ticker)
            sys.exit(1)

        # Garde-fou historique fantôme : on coupe tout ce qui précède la 1re cotation réelle.
        first_trade = SECTORAL_FIRST_TRADE.get(ticker)
        if first_trade is not None:
            before = len(df)
            df = df[pd.to_datetime(df.index).date >= first_trade]
            dropped = before - len(df)
            if dropped:
                logger.warning(
                    "%s : %d séance(s) antérieure(s) au %s écartée(s) "
                    "(historique de la coquille SPAC, pas de la société).",
                    ticker, dropped, first_trade,
                )
            if df.empty:
                logger.error(
                    "%s : aucune séance depuis le %s — vérifier le ticker et la date "
                    "de première cotation avant de relancer.", ticker, first_trade,
                )
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


def print_control_table(stats: dict[str, dict]) -> None:
    W = 74
    print()
    print("─" * W)
    print(f"  {'Ticker':<8} {'Séances':>7}  {'Première date':<13} {'Dernière date':<13} Profondeur")
    print("─" * W)
    for ticker in SECTORAL_TICKERS:
        if ticker not in stats:
            print(f"  {ticker:<8} {'N/A':>7}  {'—':<13} {'—':<13} ⚠ ABSENT")
            continue
        v = stats[ticker]
        if v["count"] >= _FULL_YEAR_SESSIONS:
            depth = "1 an complet"
        else:
            depth = f"IPO récente — {v['count']} séances"
        print(
            f"  {ticker:<8} {v['count']:>7}  {str(v['first']):<13} {str(v['last']):<13} {depth}"
        )
    print("─" * W)
    print()
    full = [t for t, v in stats.items() if v["count"] >= _FULL_YEAR_SESSIONS]
    short = [t for t, v in stats.items() if v["count"] < _FULL_YEAR_SESSIONS]
    logger.info("%d ticker(s) avec 1 an complet : %s", len(full), ", ".join(full) or "—")
    if short:
        logger.info(
            "%d ticker(s) IPO récente (historique partiel, normal) : %s",
            len(short), ", ".join(short),
        )


def main() -> None:
    db = _supabase_client()
    end = last_close_date()
    stats = backfill_sectoral(db, start=SECTORAL_HISTORY_START, end=end)
    print_control_table(stats)


if __name__ == "__main__":
    main()
