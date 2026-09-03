"""
Seed des instruments dilutifs et des prix de référence (C7, migration 016).

Trois écritures, saisie manuelle éditoriale, sur le même modèle que seed_events.py :
  · company_warrant          — un instrument par ligne (warrants, obligations convertibles)
  · company_reference_price  — prix de référence sourcés (premier jour de cotation…)
  · company_financials       — colonnes GAAP / non-cash ajoutées par la migration 016

RÈGLE DE LA MAISON (dure) : source_url OBLIGATOIRE partout. Le script REFUSE
d'écrire quoi que ce soit si une seule ligne est invalide — jamais d'état partiel.

⚠ RÈGLE §10 — AUCUN AGRÉGAT. Ni ce script ni le front ne calculent de « total de
dilution potentielle ». Additionner des warrants dont les strikes vont de 11,50 $ à
155,00 $ supposerait qu'ils seront tous exercés : ce serait publier une projection
de cours déguisée en fait. Les lignes s'affichent côte à côte, jamais sommées.

Idempotent : upsert on_conflict sur les clés primaires. Relancer après correction
d'un chiffre met la ligne à jour, sans doublon.

Prérequis : migration 016 appliquée (Supabase dashboard).

Usage :
    cd scripts && python3 seed_warrants.py
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


# ─── Warrants et instruments convertibles ─────────────────────────────────────
# Une ligne = un instrument nommé. `shares_callable` à None = le dépôt ne publie
# pas le nombre → affiché « — » côté fiche, jamais estimé.
#
# `is_derived = True` impose `derivation_note` (contrainte en base) : le calcul est
# alors publié au lecteur, il ne reste pas dans nos têtes.
WARRANTS = [
    # ═══ PSQL (Pasqal Holding SA) — 20-F du 02/09/2026, point 10.A ═══════════
    #
    # ⚠ DOCTRINE PSQLW : le TITRE PSQLW n'est pas suivi comme actif coté (pas de
    #   série de cours, pas de capitalisation — cf. migration 014). Exposer ici le
    #   nombre et le strike des warrants est autre chose : c'est un fait dilutif
    #   sur l'action PSQL, publié dans un dépôt. Les deux positions coexistent.
    {
        "ticker":          "PSQL",
        "series":          "public",
        "label":           "Warrants publics (PSQLW)",
        "shares_callable": 17_333_333,
        "strike_usd":      11.50,
        "as_of_date":      "2026-08-27",
        "expires_on":      None,   # échéance non datée dans le 20-F — on n'invente pas
        "issued_on":       None,
        "note": (
            "Issus des warrants du SPAC Bleichroeder, convertis 1:1 à la clôture de la "
            "fusion : « each then issued and outstanding whole warrant to purchase "
            "Bleichroeder Class A Ordinary Shares was converted into one warrant to "
            "purchase one Ordinary Share »."
        ),
        "source_form":     "20-F",
        "source_filed":    "2026-09-02",
        "source_url":      "https://www.sec.gov/Archives/edgar/data/2119292/000121390026096761/ea0303765-20f_pasqal.htm",
    },
    {
        "ticker":          "PSQL",
        "series":          "investment",
        "label":           "Warrants d’investissement",
        "shares_callable": 32_552_083,
        "strike_usd":      12.00,
        "as_of_date":      "2026-08-27",
        "expires_on":      None,
        "issued_on":       None,
        "note": (
            "Émis dans le cadre du financement adossé à l’opération, pour un prix de "
            "souscription global de 250,0 M$. Presque deux fois le nombre de warrants "
            "publics, à un strike voisin — la ligne la plus lourde des deux."
        ),
        "source_form":     "20-F",
        "source_filed":    "2026-09-02",
        "source_url":      "https://www.sec.gov/Archives/edgar/data/2119292/000121390026096761/ea0303765-20f_pasqal.htm",
    },
    {
        "ticker":          "PSQL",
        "series":          "convertible_bond",
        "label":           "Obligations convertibles senior non garanties",
        "shares_callable": 26_041_667,
        "strike_usd":      12.00,
        "as_of_date":      "2026-08-27",
        "expires_on":      None,
        "issued_on":       None,
        # Pourquoi une obligation convertible figure dans une table nommée
        # « warrant » : le lecteur d'une fiche société se demande ce qui peut créer
        # des actions nouvelles. Lister les warrants en taisant 312,5 M$ de dette
        # convertible au même prix d'exercice donnerait une image partielle — et le
        # reproche ne serait pas « vous avez trop dit », mais « vous avez omis ».
        "note": (
            "312,5 M$ de principal, convertibles au prix initial de 12,00 $ par action. "
            "Ce n’est pas un warrant mais un instrument convertible : il figure ici "
            "parce qu’il crée des actions nouvelles au même titre, et l’omettre "
            "donnerait une image partielle de la dilution possible."
        ),
        "source_form":     "20-F",
        "source_filed":    "2026-09-02",
        "source_url":      "https://www.sec.gov/Archives/edgar/data/2119292/000121390026096761/ea0303765-20f_pasqal.htm",
    },

    # ═══ IONQ — trois lignes, JAMAIS additionnées ════════════════════════════
    # Strikes de 11,50 $ à 155,00 $, soit un rapport de 1 à 13 : un « total de
    # dilution potentielle » serait un chiffre sans référent, et supposerait un
    # cours futur. Chaque ligne porte sa source et sa date.
    {
        "ticker":          "IONQ",
        "series":          "public",
        "label":           "Warrants publics (IONQ WS)",
        "shares_callable": 1_065_043,
        "strike_usd":      11.50,
        "as_of_date":      "2026-06-30",
        "expires_on":      "2026-09-30",
        "issued_on":       None,
        "note": (
            "Hérités de la fusion SPAC de 2021. Ils cessent de coter au NYSE avant "
            "l’ouverture du 29 septembre 2026 et expirent le 30 septembre : ce qui "
            "n’aura pas été exercé s’éteint. C’est la seule des trois lignes à avoir "
            "une date de fin."
        ),
        "source_form":     "10-Q",
        "source_filed":    "2026-08-10",
        "source_url":      "https://www.sec.gov/Archives/edgar/data/1824920/000119312526341001/ionq-20260630.htm",
    },
    {
        "ticker":          "IONQ",
        "series":          "series_a",
        "label":           "Warrants Series A",
        "shares_callable": 36_042_530,
        "strike_usd":      99.88,
        "as_of_date":      "2026-06-30",
        "expires_on":      None,
        "issued_on":       "2025-07-09",
        "note": (
            "Émis avec l’augmentation de capital de 1,0 Md$ de juillet 2025, sans "
            "contrepartie supplémentaire, exerçables sept ans. Prix d’exercice INITIAL "
            "de 99,88 $ : les termes d’un warrant peuvent être ajustés, la valeur "
            "affichée est celle du prospectus."
        ),
        "source_form":     "424B5",
        "source_filed":    "2025-07-09",
        "source_url":      "https://www.sec.gov/Archives/edgar/data/1824920/000119312525155901/d872422d424b5.htm",
    },
    {
        "ticker":          "IONQ",
        "series":          "series_b",
        "label":           "Warrants Series B",
        "shares_callable": 43_010_800,
        "strike_usd":      155.00,
        "as_of_date":      "2026-06-30",
        "expires_on":      None,
        "issued_on":       "2025-10-10",
        # Source société (newsroom IonQ) et non dépôt SEC : acceptable ici car il
        # s'agit du communiqué officiel de l'émetteur sur sa propre opération. Le
        # nombre est par ailleurs recoupé par le 10-Q du 10/08/2026.
        "note": (
            "Émis avec l’augmentation de capital de 2,0 Md$ d’octobre 2025, souscrite "
            "par une entité gérée par Heights Capital Management, exerçables sept ans. "
            "Prix d’exercice initial de 155,00 $, soit le double du cours de clôture du "
            "9 octobre 2025. Nombre recoupé par le 10-Q du 10/08/2026."
        ),
        "source_form":     "communiqué IonQ",
        "source_filed":    "2025-10-10",
        "source_url":      "https://www.ionq.com/news/ionq-announces-pricing-of-usd2-0-billion-equity-offering",
    },
]


# ─── Prix de référence ────────────────────────────────────────────────────────
# `reference_usd` est le PRIX D'OPÉRATION du SPAC, pas un cours : c'est l'ancre
# contre laquelle se contrôle toute valorisation post-fusion (CLAUDE.md).
#
# ⚠ SOURCE : les cours de la séance d'ouverture (16,98 / 20,10) ne figurent dans
#   AUCUN dépôt — ce sont des données de marché. Ils sont repris de la presse
#   spécialisée, et c'est dit tel quel plutôt que maquillé en source primaire. La
#   clôture, elle, est recoupée par notre propre base price_daily (19,11 $).
REFERENCE_PRICES = [
    {
        "ticker":         "PSQL",
        "price_date":     "2026-08-28",
        "kind":           "first_trading_day",
        "open_usd":       16.98,
        "high_usd":       20.10,
        "low_usd":        None,
        "close_usd":      19.11,
        "reference_usd":  10.00,
        "reference_note": (
            "Prix d’opération de la fusion SPAC (10,00 $ par action). C’est contre lui, "
            "et jamais contre le cours, que se contrôle la cohérence d’une valorisation "
            "post-fusion : au cours du premier jour, la capitalisation vaut près du "
            "double de la valeur d’opération sans que rien ne soit faux."
        ),
        "source_form":    "presse spécialisée",
        "source_filed":   "2026-08-29",
        "source_url":     "https://thequantuminsider.com/2026/08/29/pasqal-shares-nearly-double-in-nasdaq-debut/",
    },
]


# ─── GAAP vs non-cash ─────────────────────────────────────────────────────────
# Mise à jour de colonnes sur une ligne company_financials EXISTANTE (même ticker,
# même as_of_date, même dépôt). Le script échoue proprement si la ligne n'existe
# pas : c'est fetch_financials.py qui la crée, avec son contrôle croisé à ±10 %.
#
# Montants en MILLIERS de dollars, comme publiés au 10-Q.
GAAP_FIGURES = [
    {
        "ticker":            "IONQ",
        "as_of_date":        "2026-06-30",
        "net_loss":          -1_867_742,   # perte nette du trimestre
        "warrant_fv_change": -1_649_115,   # dont revalorisation du passif de warrants
        "warrant_liability":  3_052_398,   # passif de warrants au bilan
    },
]

_UNITS_NOTE = "milliers de dollars"


def _supabase_client() -> Client:
    return create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_KEY"])


def _validate() -> None:
    """Refuse toute écriture si une seule ligne est invalide (pas d'état partiel)."""
    errors: list[str] = []

    for i, w in enumerate(WARRANTS):
        tag = f"warrant[{i}] {w.get('ticker')} {w.get('series')}"
        if not w.get("source_url"):
            errors.append(f"{tag} : source_url manquant (règle de la maison)")
        if not w.get("source_form") or not w.get("source_filed"):
            errors.append(f"{tag} : source_form / source_filed manquant")
        if not w.get("label"):
            errors.append(f"{tag} : label manquant")
        if w.get("strike_usd") is None:
            errors.append(f"{tag} : strike_usd manquant")
        if w.get("is_derived") and not w.get("derivation_note"):
            errors.append(f"{tag} : is_derived sans derivation_note — le calcul doit être publié")
        for key in ("as_of_date", "source_filed", "expires_on", "issued_on"):
            val = w.get(key)
            if val is None and key in ("expires_on", "issued_on"):
                continue
            try:
                date.fromisoformat(val)
            except (TypeError, ValueError):
                errors.append(f"{tag} : {key} non ISO (YYYY-MM-DD)")

    for i, r in enumerate(REFERENCE_PRICES):
        tag = f"prix[{i}] {r.get('ticker')} {r.get('price_date')}"
        if not r.get("source_url"):
            errors.append(f"{tag} : source_url manquant (règle de la maison)")
        if r.get("reference_usd") is not None and not r.get("reference_note"):
            errors.append(f"{tag} : reference_usd sans reference_note — un prix d'opération "
                          f"sans explication se confond avec un cours")
        for key in ("price_date", "source_filed"):
            try:
                date.fromisoformat(r[key])
            except (KeyError, ValueError):
                errors.append(f"{tag} : {key} non ISO (YYYY-MM-DD)")

    for i, g in enumerate(GAAP_FIGURES):
        tag = f"gaap[{i}] {g.get('ticker')} {g.get('as_of_date')}"
        if g.get("net_loss") is None:
            errors.append(f"{tag} : net_loss manquant")
        if g.get("warrant_fv_change") is not None and g.get("net_loss") is not None:
            # Une composante ne peut pas excéder le total qu'elle compose.
            if abs(g["warrant_fv_change"]) > abs(g["net_loss"]):
                errors.append(
                    f"{tag} : la revalorisation de warrants ({g['warrant_fv_change']:,}) "
                    f"excède la perte nette ({g['net_loss']:,}) — vérifier le dépôt"
                )

    if errors:
        for e in errors:
            logger.error("::error::%s", e)
        logger.error("Aucune écriture — corriger les %d erreur(s) ci-dessus.", len(errors))
        sys.exit(1)


def seed_warrants(db: Client) -> None:
    _validate()

    rows = [{
        "ticker":          w["ticker"],
        "series":          w["series"],
        "label":           w["label"],
        "shares_callable": w.get("shares_callable"),
        "strike_usd":      w["strike_usd"],
        "as_of_date":      w["as_of_date"],
        "expires_on":      w.get("expires_on"),
        "issued_on":       w.get("issued_on"),
        "is_derived":      bool(w.get("is_derived", False)),
        "derivation_note": w.get("derivation_note"),
        "note":            w.get("note"),
        "source_form":     w["source_form"],
        "source_filed":    w["source_filed"],
        "source_url":      w["source_url"],
    } for w in WARRANTS]
    db.table("company_warrant").upsert(rows, on_conflict="ticker,series").execute()
    logger.info("Upsert de %d instrument(s) dilutif(s) :", len(rows))
    for w in WARRANTS:
        n = f"{w['shares_callable']:,}".replace(",", " ") if w.get("shares_callable") else "—"
        logger.info("  ✓ %-5s %-17s %17s à %8.2f $  (%s)",
                    w["ticker"], w["series"], n, w["strike_usd"], w["source_form"])

    if REFERENCE_PRICES:
        db.table("company_reference_price").upsert(
            REFERENCE_PRICES, on_conflict="ticker,price_date"
        ).execute()
        logger.info("Upsert de %d prix de référence.", len(REFERENCE_PRICES))

    # GAAP : UPDATE ciblé, pas un upsert — la ligne appartient à fetch_financials.py,
    # qui seul sait la créer après son contrôle croisé à ±10 %. Si elle n'existe pas,
    # on le DIT au lieu de fabriquer une ligne de liquidités incomplète.
    for g in GAAP_FIGURES:
        res = (
            db.table("company_financials")
            .update({
                "net_loss":          g["net_loss"],
                "warrant_fv_change": g.get("warrant_fv_change"),
                "warrant_liability": g.get("warrant_liability"),
            })
            .eq("ticker", g["ticker"])
            .eq("as_of_date", g["as_of_date"])
            .execute()
        )
        if res.data:
            logger.info("  ✓ %-5s %s · perte nette et décomposition non-cash (%s)",
                        g["ticker"], g["as_of_date"], _UNITS_NOTE)
        else:
            logger.warning(
                "::warning::Aucune ligne company_financials pour %s au %s — chiffres GAAP "
                "NON écrits. Lancer d'abord `python3 fetch_financials.py %s`.",
                g["ticker"], g["as_of_date"], g["ticker"],
            )

    logger.info("Seed des instruments dilutifs terminé.")


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
    seed_warrants(db)
    _revalidate()


if __name__ == "__main__":
    main()
