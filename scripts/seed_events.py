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
from urllib import error as urlerror
from urllib import request as urlrequest

from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv(dotenv_path="../.env.local")
load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
logger = logging.getLogger(__name__)

# Types autorisés — miroir EXACT du CHECK, migration 008 puis 015.
# 'gouvernance' et 'partenariat' ajoutés par la migration 015 (septembre 2026) :
#   · gouvernance — conseil, dirigeants, vote d'actionnaires ;
#   · partenariat — accord de recherche ou de déploiement SANS montant publié.
#     Distinct de 'contrat', qui suppose une commande chiffrée : les confondre
#     laisserait croire à un chiffre d'affaires là où il n'y a qu'un accord-cadre.
# Trois autres miroirs à tenir : t.evenements.types (fr.ts), TYPE_FAMILY
# (EventTimeline.tsx), et le bloc SQL de CLAUDE.md §C6.
ALLOWED_TYPES = {
    "ipo", "spac", "reverse_split", "dilution", "contrat",
    "resultats", "acquisition", "reglementaire", "technologie", "autre",
    "gouvernance", "partenariat",
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
    # ⚠ ENRICHISSEMENT (2026-09-03) — PAS un doublon. L'événement existait déjà avec
    # la clôture du premier jour ; on y ajoute l'ouverture et le plus haut de séance,
    # et le décompte d'actions publié depuis par le 20-F. Le TITRE est inchangé : la
    # clé de conflit étant (ticker, event_date, title), l'upsert MET À JOUR la ligne
    # au lieu d'en créer une seconde. Modifier le titre laisserait un orphelin.
    {
        "ticker": "PSQL",
        "event_date": "2026-08-28",
        "type": "spac",
        "title": "Première cotation au Nasdaq après fusion SPAC avec Bleichroeder",
        "description": (
            "Deuxième société européenne du quantique cotée sur une grande place américaine, "
            "après IQM. Fusion avec Bleichroeder Acquisition Corp. II approuvée par les "
            "actionnaires le 25 août 2026 et finalisée le 27 août ; l'action ordinaire cote "
            "depuis le 28 août sous le symbole PSQL (le titre PSQLW, qui porte les warrants, "
            "n'est pas suivi ici comme actif coté). Première séance : ouverture à 16,98 $, "
            "plus haut à 20,10 $, clôture à 19,11 $, soit +91 % au-dessus du prix d'opération "
            "de 10,00 $. L'opération valorisait Pasqal environ 2 Md$ et apporte environ "
            "360 M$ de trésorerie à la clôture selon le communiqué. Le capital social "
            "post-fusion — 212 293 691 actions ordinaires au 27 août — n'a été publié que le "
            "2 septembre, avec le 20-F. Technologie à atomes neutres, siège à Palaiseau "
            "(France)."
        ),
        # Lien profond vers l'exhibit 99.1 du 6-K de closing (communiqué conjoint officiel).
        "source_url": "https://www.sec.gov/Archives/edgar/data/2119292/000121390026094393/ea030366701ex99-1.htm",
        "source_label": "Communiqué de closing — 6-K SEC du 27/08/2026",
    },
    {
        "ticker": "PSQL",
        "event_date": "2026-08-25",
        "type": "gouvernance",
        "title": "Les actionnaires de Bleichroeder approuvent la fusion",
        "description": (
            "Assemblée générale extraordinaire du SPAC : 24 086 739 actions représentées sur "
            "38 333 333 en circulation (62,8 %, quorum atteint). La fusion est approuvée par "
            "21 467 865 voix contre 2 616 196, ainsi que les neuf administrateurs de la "
            "société combinée et les plans d'intéressement. Le même dépôt indique que les "
            "porteurs de 26 039 602 actions Class A ont demandé le rachat de leurs titres — "
            "c'est ce niveau de rachats qui explique que le capital social final "
            "(212,3 M actions) se situe près de la borne basse de la fourchette du "
            "prospectus [209,6 M ; 238,3 M]."
        ),
        "source_url": "https://www.sec.gov/Archives/edgar/data/2088295/000121390026094046/ea0303286-8k425_bleich2.htm",
        "source_label": "8-K SEC du 26/08/2026 (points 5.07 et 8.01)",
    },
    {
        "ticker": "PSQL",
        "event_date": "2026-08-27",
        "type": "gouvernance",
        "title": "Conseil d'administration de neuf membres, présidé par Alain Aspect",
        "description": (
            "Le conseil de Pasqal Holding SA est présidé, à titre NON EXÉCUTIF, par Alain "
            "Aspect, cofondateur de Pasqal et prix Nobel de physique 2022. Wasiq Bokhari est "
            "directeur général et administrateur ; Michel Combes (Lambda, Brightspeed, "
            "ex-SoftBank International, Sprint, Altice, Alcatel-Lucent) est administrateur "
            "référent indépendant. La présidence et la direction générale sont donc séparées : "
            "c'est un fait de gouvernance, rapporté sans appréciation."
        ),
        "source_url": "https://www.globenewswire.com/news-release/2026/08/27/3352409/0/en/pasqal-announces-the-board-of-directors-of-the-combined-company-following-its-nasdaq-listing.html",
        "source_label": "Communiqué Pasqal du 27/08/2026",
    },
    {
        "ticker": "PSQL",
        "event_date": "2026-08-31",
        "type": "partenariat",
        "title": "Accord de recherche pluriannuel avec la KACST (Arabie saoudite)",
        "description": (
            "Accord de collaboration signé avec la King Abdulaziz City for Science and "
            "Technology, représentée par son National Center for Quantum Technologies (NCQT), "
            "annoncé à Riyad au King Salman Science Oasis. Les travaux portent d'abord sur la "
            "cryptographie résistante au quantique et associent les processeurs à atomes "
            "neutres et les services cloud de Pasqal à l'infrastructure de recherche de la "
            "KACST. AUCUN MONTANT N'EST PUBLIÉ : c'est un accord-cadre de recherche, pas une "
            "commande — le porter au chiffre d'affaires serait une inférence."
        ),
        # Communiqué d'origine sur le fil de l'émetteur. Les reprises (HPCwire et autres
        # titres spécialisés) sont écartées au profit de la source première.
        "source_url": "https://www.globenewswire.com/news-release/2026/08/31/3353273/0/en/pasqal-and-kacst-launch-strategic-quantum-research-collaboration-as-pasqal-expands-presence-in-saudi-arabia.html",
        "source_label": "Communiqué Pasqal du 31/08/2026",
    },
    {
        "ticker": "PSQL",
        "event_date": "2026-09-02",
        "type": "technologie",
        "title": "Structures de gélation protéique encodées sur QPU, avec True Nexus",
        "description": (
            "Avec True Nexus, Pasqal annonce avoir encodé sur ses processeurs à atomes neutres "
            "des structures protéiques liées aux mécanismes de gélation — le passage du "
            "liquide au gel qui donne leur texture aux aliments. Travaux soutenus par le "
            "ministère saoudien des Communications et des Technologies de l'information. "
            "Étape de recherche annoncée par les partenaires : ni produit commercialisé, ni "
            "avantage quantique démontré."
        ),
        "source_url": "https://www.globenewswire.com/news-release/2026/09/02/3355080/0/en/pasqal-and-true-nexus-open-a-new-quantum-frontier-for-the-global-protein-economy.html",
        "source_label": "Communiqué Pasqal du 02/09/2026",
    },
    # ⚠ RENOMMAGE (2026-09-03) — le titre portait « Le 20-F publie enfin le capital
    # social post-fusion ». La clé de conflit étant (ticker, event_date, title), ce
    # changement de titre a laissé un ORPHELIN, supprimé par un DELETE SQL manuel :
    #   delete from sector_event where ticker = 'PSQL' and event_date = '2026-09-02'
    #     and title = 'Le 20-F publie enfin le capital social post-fusion';
    # Motif du renommage : le chiffre dans le titre se lit directement dans la frise.
    {
        "ticker": "PSQL",
        "event_date": "2026-09-02",
        # `autre` et non `resultats` : un 20-F publie bien des comptes, mais l'événement
        # documenté ici est la parution d'un DÉCOMPTE D'ACTIONS, pas des résultats.
        "type": "autre",
        "title": "Le 20-F publie le capital social : 212 293 691 actions",
        "description": (
            "212 293 691 actions ordinaires en circulation au 27 août 2026 (couverture et "
            "point 10.A du rapport annuel). C'est le PREMIER document déposé à publier ce "
            "chiffre : ni le 6-K de clôture, ni les communications relatives aux rachats ne "
            "le donnaient. Jusque-là, la seule valeur disponible (209 583 333) était "
            "l'hypothèse de rachat maximal du prospectus, la fourchette réelle montant à "
            "238 333 333 — 13,7 % d'écart. "
            "C'est pourquoi The Quantum Wall n'a affiché AUCUNE capitalisation pour Pasqal "
            "du 28 août au 2 septembre : la société figurait dans le tableau, ses cours et "
            "ses variations étaient publiés, mais capitalisation et ratio cours/chiffre "
            "d'affaires restaient à « — », faute de source primaire. Reprendre la valeur "
            "servie par les données de marché aurait affiché une capitalisation minorée, en "
            "la présentant comme sourcée. L'écart s'est révélé être de 1,3 % seulement, mais "
            "rien, au moment de choisir, ne permettait de le savoir. Les deux chiffres sont "
            "calculés et publiés depuis le 3 septembre."
        ),
        "source_url": "https://www.sec.gov/Archives/edgar/data/2119292/000121390026096761/ea0303765-20f_pasqal.htm",
        "source_label": "Rapport annuel 20-F déposé le 02/09/2026",
    },
    {
        "ticker": "IONQ",
        "event_date": "2026-08-24",
        "type": "gouvernance",
        "title": "Deux administrateurs supplémentaires : Eric R. Ball et Timothy E. Baxter",
        "description": (
            "Le conseil crée deux sièges et élit Eric R. Ball (classe II, mandat jusqu'à "
            "l'assemblée 2029) et Timothy E. Baxter (classe III, mandat jusqu'à l'assemblée "
            "2027), avec effet au 24 août 2026. Aucun départ n'est déclaré : le conseil "
            "s'élargit."
        ),
        # Le 8-K est daté du 28/08 mais porte la date d'effet du 24/08 — c'est cette
        # dernière qui fait foi pour la frise (« effective August 24, 2026 »).
        "source_url": "https://www.sec.gov/Archives/edgar/data/1824920/000119312526374694/ionq-20260824.htm",
        "source_label": "8-K SEC du 28/08/2026 (point 5.02)",
    },
    {
        "ticker": "IONQ",
        "event_date": "2026-09-08",
        "type": "autre",
        "title": "Journée investisseurs au NYSE",
        "description": (
            "Journée investisseurs annoncée à l'occasion de la clôture de l'acquisition de "
            "SkyWater Technology. Aucun chiffre n'est communiqué par avance ; ce qui y sera "
            "dit relèvera de la communication de la société, pas d'un dépôt réglementaire."
        ),
        "source_url": "https://www.sec.gov/Archives/edgar/data/1824920/000119312526327127/ionq-ex99_1.htm",
        "source_label": "Communiqué IonQ du 31/07/2026 — 8-K SEC",
    },
    {
        "ticker": "IONQ",
        "event_date": "2026-09-30",
        "type": "dilution",
        "title": "Expiration des warrants publics à 11,50 $",
        "description": (
            "Les warrants publics issus de la fusion SPAC de 2021 expirent le 30 septembre "
            "2026 ; ils cessent de coter au NYSE sous le symbole IONQ WS avant l'ouverture du "
            "29 septembre. Il en restait 1 065 043 au 30 juin 2026, chacun donnant droit à "
            "une action à 11,50 $ (10-Q du 10/08/2026). Ce qui n'aura pas été exercé d'ici là "
            "s'éteint : à la différence des warrants Series A et Series B, cette ligne a une "
            "date de fin."
        ),
        "source_url": "https://www.sec.gov/Archives/edgar/data/1824920/000119312526374694/ionq-20260824.htm",
        "source_label": "8-K SEC du 28/08/2026 (point 8.01)",
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
    {
        "ticker": "HQ",
        "event_date": "2026-08-04",
        "type": "resultats",
        "title": "Premiers résultats trimestriels (T2 2026)",
        "description": (
            "Première publication de résultats depuis la cotation via SPAC. Résultats du "
            "trimestre clos le 30 juin, publiés avant l'ouverture, conférence à 8h00 ET. "
            "Rendez-vous clé après l'envolée de +208 % de juin sur un chiffre d'affaires "
            "quasi nul."
        ),
        # Source = communiqué officiel Horizon Quantum via Businesswire (source primaire),
        # PAS une reprise (ex. The Quantum Insider). URL de news Businesswire de la société ;
        # à remplacer par le lien profond du communiqué daté quand il est publié (seed idempotent).
        "source_url": "https://www.businesswire.com/portal/site/home/search/?searchType=news&searchTerm=Horizon+Quantum",
        "source_label": "Communiqué officiel — Horizon Quantum (Businesswire)",
    },
    {
        "ticker": "QUBT",
        "event_date": "2026-08-10",
        "type": "resultats",
        "title": "Résultats T2 2026",
        "description": (
            "Chiffre d'affaires trimestriel de 5,6 M$ contre 61 k$ un an plus tôt, perte "
            "nette de 11,8 M$. La société clôt le trimestre sur 1,3 Md$ de trésorerie, "
            "équivalents et placements — contre environ 1,5 Md$ fin 2025, l'écart "
            "correspondant aux ~180 M$ décaissés pour les acquisitions de Luminar "
            "Semiconductor, NuCrypt et NHanced Semiconductors."
        ),
        # ⚠ CORRECTION DE SAISIE (2026-08-16). Une note antérieure retenait ~954 M$ de
        # liquidités. Ce chiffre est trésorerie + placements COURANTS seuls
        # (189,150 + 765,020 = 954,170 k$) : il omet les 369,3 M$ de placements NON
        # COURANTS, qui sont pourtant des titres AFS négociables — la somme des deux
        # seaux égale au dollar près le portefeuille AFS total publié (1 134 304 k$).
        # La société écrit « Ends quarter with $1.3 billion in cash, cash equivalents
        # and investments ». Le périmètre partiel est le MÊME défaut que celui corrigé
        # dans edgar.py le même jour ; il est ici corrigé à la source.
        "source_url": "https://www.sec.gov/Archives/edgar/data/1758009/000121390026087267/ea030143301ex99-1.htm",
        "source_label": "Communiqué de résultats T2 2026 — 8-K ex. 99.1 (SEC EDGAR)",
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


def _revalidate() -> None:
    """Purge le cache ISR des fiches sociétés après le seed (best-effort).

    Sans REVALIDATE_SECRET configuré, on ne fait rien — le contenu apparaîtra à
    l'expiration naturelle de l'ISR (24 h) ou au prochain déploiement. Une erreur
    réseau ne fait jamais échouer le seed : la base est déjà à jour.
    """
    secret = os.environ.get("REVALIDATE_SECRET")
    if not secret:
        logger.info("REVALIDATE_SECRET absent — pas de purge ISR (contenu visible sous 24 h).")
        return
    base = os.environ.get("SITE_URL", "https://thequantumwall.com").rstrip("/")
    url = f"{base}/api/revalidate?secret={secret}"
    try:
        req = urlrequest.Request(url, method="POST")
        with urlrequest.urlopen(req, timeout=15) as resp:
            logger.info("Revalidation ISR déclenchée (%s) : HTTP %s", base, resp.status)
    except (urlerror.URLError, TimeoutError) as e:
        logger.warning("::warning::Revalidation ISR échouée (%s) — base à jour, "
                       "contenu visible sous 24 h. Détail : %s", base, e)


def main() -> None:
    db = _supabase_client()
    seed_events(db, EVENTS)
    _revalidate()


if __name__ == "__main__":
    main()
