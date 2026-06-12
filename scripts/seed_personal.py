"""
Seed one-shot : insère le portefeuille personnel et ses 6 positions.
Les quantités sont fixes (pas de calcul depuis des poids).
Le capital initial est calculé comme la valeur de marché totale à la date d'inception.

Prérequis : migration 003 appliquée, backfill des prix effectué.

Usage :
    cd scripts && python seed_personal.py
"""

import logging
import os
import sys
from datetime import date

from dotenv import load_dotenv
from supabase import create_client, Client

from market_data import fetch_adj_close

load_dotenv(dotenv_path="../.env.local")
load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
logger = logging.getLogger(__name__)

INCEPTION_DATE = "2026-06-01"

# Positions exactes — quantités figées, PRU historique
POSITIONS = [
    {"ticker": "IONQ",  "account": "CTO", "quantity": 179.0,   "avg_cost_usd": 25.54},
    {"ticker": "QBTS",  "account": "CTO", "quantity": 160.0,   "avg_cost_usd": 11.90},
    {"ticker": "IBM",   "account": "CTO", "quantity": 11.0,    "avg_cost_usd": 172.00},
    {"ticker": "LAES",  "account": "CTO", "quantity": 669.0,   "avg_cost_usd": 2.36},
    {"ticker": "GOOGL", "account": "CTO", "quantity": 7.0,     "avg_cost_usd": 301.08},
    {"ticker": "GOOGL", "account": "PER", "quantity": 19.7722, "avg_cost_usd": 228.45},
]


def _supabase_client() -> Client:
    return create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_KEY"])


def seed_personal(db: Client, inception: date) -> None:
    tickers = list({p["ticker"] for p in POSITIONS})

    logger.info("Récupération des prix d'inception (%s)…", inception)
    prices = fetch_adj_close(tickers, start=inception, end=inception)

    if inception not in prices.index:
        logger.error(
            "Pas de cotation le %s (jour non ouvré ou backfill manquant). "
            "Vérifier que le backfill couvre cette date.",
            inception,
        )
        sys.exit(1)

    # Capital initial = valeur de marché totale au jour d'inception
    initial_capital = 0.0
    for pos in POSITIONS:
        ticker = pos["ticker"]
        qty = pos["quantity"]
        adj_close = float(prices.loc[inception, ticker])
        val = qty * adj_close
        initial_capital += val
        logger.info(
            "  %s (%s) : qty=%.4f adj_close=%.4f valeur=%.2f",
            ticker, pos["account"], qty, adj_close, val,
        )

    logger.info("Capital initial calculé : %.2f USD", initial_capital)

    logger.info("Upsert du portefeuille 'personnel'…")
    db.table("portfolio").upsert({
        "id":                  "personnel",
        "name":                "Mon portefeuille",
        "description":         "Portefeuille personnel — suivi depuis le 1er juin 2026.",
        "inception_date":      inception.isoformat(),
        "initial_capital_usd": round(initial_capital, 2),
        "type":                "personnel",
    }).execute()

    logger.info("Upsert des %d positions…", len(POSITIONS))
    position_rows = []
    for pos in POSITIONS:
        ticker = pos["ticker"]
        qty = pos["quantity"]
        adj_close = float(prices.loc[inception, ticker])
        target_weight = (qty * adj_close) / initial_capital
        position_rows.append({
            "portfolio_id":  "personnel",
            "ticker":        ticker,
            "account":       pos["account"],
            "target_weight": round(target_weight, 8),
            "quantity":      pos["quantity"],
            "avg_cost_usd":  pos["avg_cost_usd"],
        })

    db.table("position").upsert(position_rows).execute()
    logger.info("Seed du portefeuille personnel terminé.")


def main() -> None:
    inception = date.fromisoformat(INCEPTION_DATE)
    db = _supabase_client()
    seed_personal(db, inception)


if __name__ == "__main__":
    main()
