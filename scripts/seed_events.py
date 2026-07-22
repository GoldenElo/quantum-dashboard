"""
Seed de la base d'événements sectoriels (C6, table sector_event).

Saisie manuelle éditoriale — PAS d'interface d'admin (hors périmètre). Éditer la
liste EVENTS ci-dessous, puis relancer. Idempotent : upsert on_conflict sur
(ticker, event_date, title) → aucun doublon en cas de ré-exécution.

RÈGLE DE LA MAISON (dure) : source_url OBLIGATOIRE. Le script REFUSE d'écrire quoi
que ce soit si un seul événement est invalide (source manquante, type hors liste,
date non ISO) — jamais d'écriture partielle.

Prérequis : migration 008 appliquée (Supabase dashboard).

Usage :
    cd scripts && python seed_events.py
"""

import logging
import os
import sys
from datetime import date

from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv(dotenv_path="../.env.local")
load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
logger = logging.getLogger(__name__)

# Types autorisés — miroir EXACT du CHECK de la migration 008.
ALLOWED_TYPES = {
    "ipo", "spac", "reverse_split", "dilution", "contrat",
    "resultats", "acquisition", "reglementaire", "technologie", "autre",
}

# ─── Événements réels, sourcés ─────────────────────────────────────────────────
# ticker=None → événement sectoriel global (non affiché sur les fiches individuelles).
# Éditer/compléter ici. Toute ligne DOIT avoir un source_url.
#
# NOTE SOURCES : les liens SEC ci-dessous pointent la LISTE des dépôts EDGAR de la
# société (page filing-list stable, construite par ticker) — pas le PDF exact du
# document. À remplacer par le lien profond (accession) quand tu l'as sous la main ;
# le seed étant idempotent, un simple re-run avec l'URL exacte met à jour la ligne.
EVENTS = [
    {
        "ticker": "QNT",
        "event_date": "2026-06-05",
        "type": "ipo",
        "title": "Introduction en bourse au Nasdaq",
        "description": (
            "IPO de 28 M d'actions Class A à 60 $, levée de 1,68 Md$. Structure Up-C : "
            "seuls ~10 % du capital économique sont cotés, le reste détenu par Honeywell "
            "et les actionnaires historiques."
        ),
        "source_url": "https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&ticker=QNT&type=424B4&dateb=&owner=include&count=40",
        "source_label": "Prospectus 424B4 — SEC EDGAR",
    },
    {
        "ticker": "ARQQ",
        "event_date": "2024-09-25",
        "type": "reverse_split",
        "title": "Reverse split 25:1",
        "description": (
            "Consolidation de 25 actions en 1 pour regagner la conformité au seuil "
            "minimum de 1 $ du Nasdaq, après notifications de non-conformité reçues "
            "fin 2023."
        ),
        "source_url": "https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&ticker=ARQQ&type=6-K&dateb=&owner=include&count=40",
        "source_label": "Dépôt SEC — Arqit (EDGAR)",
    },
    {
        "ticker": "HQ",
        "event_date": "2026-03-20",
        "type": "spac",
        "title": "Finalisation de la fusion SPAC",
        "description": (
            "Clôture de la fusion avec dMY Squared Technology Group, cotation au Nasdaq "
            "sous le ticker HQ."
        ),
        "source_url": "https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&ticker=HQ&type=8-K&dateb=&owner=include&count=40",
        "source_label": "Form 8-K — SEC EDGAR",
    },
    {
        "ticker": "XNDU",
        "event_date": "2026-03-27",
        "type": "ipo",
        "title": "Introduction en bourse au Nasdaq",
        "description": (
            "Première société de calcul quantique photonique pure-player cotée en bourse."
        ),
        "source_url": "https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&ticker=XNDU&type=424B4&dateb=&owner=include&count=40",
        "source_label": "Prospectus / communiqué IPO — SEC EDGAR",
    },
    {
        "ticker": "INFQ",
        "event_date": "2026-02-17",
        "type": "ipo",
        "title": "Introduction en bourse au NYSE",
        "description": "Cotation d'Infleqtion (atomes neutres) au NYSE.",
        "source_url": "https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&ticker=INFQ&type=424B4&dateb=&owner=include&count=40",
        "source_label": "Prospectus / communiqué IPO — SEC EDGAR",
    },
    {
        "ticker": "IONQ",
        "event_date": "2026-03-31",
        "type": "dilution",
        "title": "+10,6 M d'actions en un trimestre",
        "description": (
            "Le nombre d'actions en circulation passe de 362,6 M (31/12/2025) à "
            "373,2 M (31/03/2026), soit ~+3 % de dilution en un trimestre."
        ),
        "source_url": "https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&ticker=IONQ&type=10-Q&dateb=&owner=include&count=40",
        "source_label": "Form 10-Q (31/03/2026) — SEC EDGAR",
    },
    {
        "ticker": "HQ",
        "event_date": "2026-06-18",
        "type": "autre",
        "title": "+208 % en une semaine",
        "description": (
            "Envolée spéculative post-SPAC : le titre triple en quatre séances avec des "
            "volumes 40 à 60 fois supérieurs à la normale. Signalé sur le Wall par un "
            "marqueur de volatilité extrême."
        ),
        "source_url": "https://thequantumwall.com/societe/hq",
        "source_label": "Données de marché — The Quantum Wall",
    },
    {
        "ticker": "IQMX",
        "event_date": "2026-07-02",
        "type": "spac",
        "title": "Cotation au Nasdaq après fusion SPAC avec RAAQ",
        "description": (
            "Première société européenne du quantique cotée sur une grande place américaine. "
            "Fusion avec Real Asset Acquisition Corp. finalisée le 1er juillet 2026, cotation "
            "des ADS le 2 juillet sous le symbole IQMX (1 ADS = 1 action ordinaire). "
            "14 381 747 actions remises aux actionnaires du SPAC et 14 548 000 actions placées "
            "à 10 $ auprès d'investisseurs institutionnels (PIPE de 127,7 M€), pour un produit "
            "net total d'environ 198,7 M€. Double cotation au Nasdaq Helsinki le lendemain."
        ),
        # Lien profond vers l'exhibit 99.1 du 6-K de closing (communiqué officiel).
        "source_url": "https://www.sec.gov/Archives/edgar/data/0002113060/000119312526292513/d61136dex991.htm",
        "source_label": "Communiqué de closing — 6-K SEC du 01/07/2026",
    },
]


def _supabase_client() -> Client:
    return create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_KEY"])


def _validate(events: list[dict]) -> None:
    """Refuse toute écriture si un seul événement est invalide (pas d'état partiel)."""
    errors: list[str] = []
    for i, ev in enumerate(events):
        tag = f"[{i}] {ev.get('ticker') or 'GLOBAL'} {ev.get('event_date')}"
        if not ev.get("source_url"):
            errors.append(f"{tag} : source_url manquant (règle de la maison — source obligatoire)")
        if ev.get("type") not in ALLOWED_TYPES:
            errors.append(f"{tag} : type '{ev.get('type')}' hors liste fermée")
        if not ev.get("title"):
            errors.append(f"{tag} : title manquant")
        try:
            date.fromisoformat(ev["event_date"])
        except (KeyError, ValueError):
            errors.append(f"{tag} : event_date non ISO (YYYY-MM-DD)")
    if errors:
        for e in errors:
            logger.error("::error::%s", e)
        logger.error("Aucune écriture — corriger les %d erreur(s) ci-dessus.", len(errors))
        sys.exit(1)


def seed_events(db: Client, events: list[dict]) -> None:
    _validate(events)
    rows = [{
        "ticker": ev["ticker"],
        "event_date": ev["event_date"],
        "type": ev["type"],
        "title": ev["title"],
        "description": ev.get("description"),
        "source_url": ev["source_url"],
        "source_label": ev.get("source_label"),
    } for ev in events]

    logger.info("Upsert de %d événement(s) (on_conflict ticker,event_date,title)…", len(rows))
    db.table("sector_event").upsert(rows, on_conflict="ticker,event_date,title").execute()
    for ev in events:
        logger.info("  ✓ %-5s %s · %s", ev["ticker"] or "GLOB", ev["event_date"], ev["title"])
    logger.info("Seed des événements terminé.")


def main() -> None:
    db = _supabase_client()
    seed_events(db, EVENTS)


if __name__ == "__main__":
    main()
