"""
Seed one-shot : insère les assets, les 3 portefeuilles et les positions d'inception.
À exécuter UNE SEULE FOIS après avoir renseigné INCEPTION_DATE.

Usage :
    python scripts/seed.py
"""

import logging
import os
import sys
from datetime import date

from dotenv import load_dotenv
from supabase import create_client, Client

from market_data import fetch_adj_close, check_ticker_coverage

load_dotenv(dotenv_path="../.env.local")  # Next.js convention pour les vars locales
load_dotenv()  # fallback : .env standard
logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
logger = logging.getLogger(__name__)

INCEPTION_DATE: str = "2026-06-01"

INITIAL_CAPITAL_USD = 10_000.0

# ─── Référentiel des assets ───────────────────────────────────────────────────
ASSETS = [
    {"ticker": "GOOGL", "name": "Alphabet",    "category": "geant",          "exchange": "NASDAQ", "currency": "USD"},
    {"ticker": "IBM",   "name": "IBM",          "category": "geant",          "exchange": "NYSE",   "currency": "USD"},
    {"ticker": "NVDA",  "name": "Nvidia",        "category": "infrastructure", "exchange": "NASDAQ", "currency": "USD"},
    {"ticker": "IONQ",  "name": "IonQ",          "category": "pure_player",    "exchange": "NYSE",   "currency": "USD"},
    {"ticker": "QBTS",  "name": "D-Wave",        "category": "pure_player",    "exchange": "NYSE",   "currency": "USD"},
    {"ticker": "LAES",  "name": "SEALSQ",        "category": "pure_player",    "exchange": "NASDAQ", "currency": "USD"},
    {"ticker": "INFQ",  "name": "Infleqtion",    "category": "pure_player",    "exchange": "NYSE",   "currency": "USD"},
    {"ticker": "QNTM.L", "name": "VanEck Quantum Computing UCITS ETF", "category": "etf", "exchange": "LSE", "currency": "USD"},
]

# ─── Allocations officielles (poids à l'inception) ───────────────────────────
# Chaque colonne doit sommer à 1.0 — vérifié en bas de ce fichier.
PORTFOLIOS = {
    "defensif": {
        "name":        "Défensif",
        "description": "Profil prudent, ancré sur les géants tech avec exposition quantique limitée.",
        "weights": {
            "GOOGL": 0.40,
            "IBM":   0.30,
            "NVDA":  0.20,
            "IONQ":  0.10,
        },
    },
    "dynamique": {
        "name":        "Dynamique",
        "description": "Équilibre entre géants établis et pure-players quantiques émergents.",
        "weights": {
            "GOOGL": 0.30,
            "IBM":   0.20,
            "NVDA":  0.20,
            "IONQ":  0.12,
            "QBTS":  0.09,
            "LAES":  0.09,
        },
    },
    "agressif": {
        "name":        "Agressif",
        "description": "Maximum d'exposition aux pure-players quantiques, risque élevé.",
        "weights": {
            "GOOGL": 0.20,
            "IBM":   0.10,
            "NVDA":  0.20,
            "IONQ":  0.15,
            "QBTS":  0.13,
            "LAES":  0.12,
            "INFQ":  0.10,
        },
    },
}


def _assert_weights_sum_to_one() -> None:
    for pid, p in PORTFOLIOS.items():
        total = sum(p["weights"].values())
        assert abs(total - 1.0) < 1e-9, (
            f"Portefeuille '{pid}' : poids total = {total:.6f} ≠ 1.0"
        )
    logger.info("Vérification des poids : OK")


def _supabase_client() -> Client:
    url = os.environ["SUPABASE_URL"]
    key = os.environ["SUPABASE_SERVICE_KEY"]
    return create_client(url, key)


def seed(db: Client, inception: date) -> None:
    tickers_needed = list({t for p in PORTFOLIOS.values() for t in p["weights"]})

    # ── 1. Vérification INFQ ────────────────────────────────────────────────
    logger.info("Vérification couverture INFQ (NYSE depuis 17/02/2026)…")
    if not check_ticker_coverage("INFQ", inception):
        logger.error(
            "⚠️  INFQ non couvert par yfinance à partir du %s. "
            "Le portefeuille 'agressif' sera incomplet. "
            "Corriger avant de continuer.",
            inception,
        )
        sys.exit(1)

    # ── 2. Récupération des prix d'inception ────────────────────────────────
    logger.info("Récupération des prix d'inception (%s)…", inception)
    prices = fetch_adj_close(tickers_needed + ["QNTM.L"], start=inception, end=inception)

    # ── 3. Insertion des assets ─────────────────────────────────────────────
    logger.info("Upsert des assets…")
    db.table("asset").upsert(ASSETS).execute()

    # ── 4. Insertion des portefeuilles ──────────────────────────────────────
    logger.info("Upsert des portefeuilles…")
    portfolio_rows = [
        {
            "id":                  pid,
            "name":                p["name"],
            "description":         p["description"],
            "inception_date":      inception.isoformat(),
            "initial_capital_usd": INITIAL_CAPITAL_USD,
        }
        for pid, p in PORTFOLIOS.items()
    ]
    db.table("portfolio").upsert(portfolio_rows).execute()

    # ── 5. Calcul et insertion des positions ────────────────────────────────
    position_rows = []
    for pid, p in PORTFOLIOS.items():
        for ticker, weight in p["weights"].items():
            if inception not in prices.index:
                raise ValueError(
                    f"Prix de {ticker} introuvable pour {inception}. "
                    "Vérifier que c'est bien un jour de cotation US."
                )
            adj_close = float(prices.loc[inception, ticker])
            quantity = (INITIAL_CAPITAL_USD * weight) / adj_close
            position_rows.append({
                "portfolio_id":  pid,
                "ticker":        ticker,
                "target_weight": weight,
                "quantity":      round(quantity, 8),
            })
            logger.info(
                "  %s / %s : weight=%.0f%% adj_close=%.4f qty=%.6f",
                pid, ticker, weight * 100, adj_close, quantity,
            )

    logger.info("Upsert des positions…")
    db.table("position").upsert(position_rows).execute()
    logger.info("Seed terminé.")


def main() -> None:
    _assert_weights_sum_to_one()

    inception = date.fromisoformat(INCEPTION_DATE)
    db = _supabase_client()
    seed(db, inception)


if __name__ == "__main__":
    main()
