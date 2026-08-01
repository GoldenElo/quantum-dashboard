"""
Backfill de l'Indice TQW (C3) — reconstruit la série depuis l'inception (01/06/2026).

Ne télécharge RIEN : l'indice se calcule intégralement depuis price_daily et
shares_outstanding déjà en base. À lancer une fois après avoir appliqué la
migration 010 ; ensuite ingest.py entretient la série au fil des clôtures.

Usage : cd scripts && python3 backfill_index.py [--upto YYYY-MM-DD] [--rebuild]

Par défaut, ne comble QUE les dates manquantes — une valeur publiée n'est jamais
recalculée (règle de non-rétroactivité). --rebuild PURGE index_daily et
index_weights puis reconstruit tout : réservé à une refonte délibérée de la
méthodologie, jamais à un usage courant.
"""

import logging
import os
import sys
from datetime import date

from dotenv import load_dotenv
from supabase import create_client, Client

from index_tqw import INDEX_INCEPTION, compute_index
from market_data import last_close_date

load_dotenv(dotenv_path="../.env.local")
load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
logger = logging.getLogger(__name__)


def _supabase_client() -> Client:
    return create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_KEY"])


def _purge(db: Client) -> None:
    """Vide index_daily et index_weights (uniquement sous --rebuild)."""
    logger.warning("--rebuild : purge de index_daily et index_weights…")
    db.table("index_daily").delete().gte("date", "1900-01-01").execute()
    db.table("index_weights").delete().gte("rebalance_date", "1900-01-01").execute()


def main() -> None:
    args = sys.argv[1:]
    rebuild = "--rebuild" in args
    upto = last_close_date()
    if "--upto" in args:
        upto = date.fromisoformat(args[args.index("--upto") + 1])

    logger.info("=== Backfill de l'Indice TQW : %s → %s ===", INDEX_INCEPTION, upto)

    db = _supabase_client()
    if rebuild:
        _purge(db)

    try:
        result = compute_index(db, upto, rebuild=rebuild)
    except RuntimeError as exc:
        logger.error("Backfill interrompu : %s", exc)
        sys.exit(1)
    except Exception as exc:  # noqa: BLE001 — migration 010 absente ?
        logger.error("Backfill impossible (migration 010 appliquée ?) : %s", exc)
        sys.exit(1)

    logger.info("Rebalancements :")
    for reb in result["rebalances"]:
        capped = ", ".join(reb["capped"]) or "aucune"
        logger.info(
            "  %s  %2d constituants  diviseur %.6g  écrêtées : %s%s",
            reb["date"], reb["constituents"], reb["divisor"], capped,
            "" if reb["new"] else "  (déjà figé — relu, non rejoué)",
        )
        logger.info("     %s", ", ".join(reb["tickers"]))

    logger.info(
        "%d séances · %d valeur(s) écrite(s) · %d déjà publiée(s) (non recalculée(s))",
        result["sessions"], result["written"], result["skipped"],
    )
    if result["last_value"] is not None:
        logger.info("Dernière valeur de l'indice : %.6f", result["last_value"])
    logger.info("=== Backfill terminé. Contrôler avec : python3 check_index.py ===")


if __name__ == "__main__":
    main()
