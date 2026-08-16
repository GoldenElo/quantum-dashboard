"""
Couche d'accès à EDGAR (SEC) — source primaire officielle, sans clé d'API.

Module ISOLÉ, au même titre que market_data.py : TOUT appel réseau vers la SEC
est centralisé ici. Aucun autre fichier ne construit d'URL data.sec.gov.

RÉUTILISABLE POUR S8. Les briques génériques (`fetch_json`, `recent_filings`,
`filing_url`, l'en-tête User-Agent, le throttle, le cache disque) sont écrites
pour servir aussi les futures intégrations de données publiques : USAspending,
NSF Awards, DARPA QBI. Ne pas y mêler de logique propre à la dilution — celle-ci
vit dans les fonctions `annual_share_counts` / `quarterly_cash_and_burn`.

RÈGLES DURES DE L'API SEC (apprises à la vérification, ne pas « re-simplifier ») :

  1. **User-Agent nominatif obligatoire.** La SEC rejette l'UA par défaut des
     bibliothèques HTTP. La politique d'accès exige un contact identifiable.
  2. **10 requêtes/seconde maximum.** Au-delà, blocage de l'IP. `_throttle()`
     sérialise les appels ; ne jamais paralléliser par-dessus.
  3. **`companyfacts` ne porte AUCUNE ventilation dimensionnelle.** Les faits
     tagués par classe d'actions (structures à double classe) sont absents ou
     réduits à un total. C'est la raison pour laquelle XNDU et HQ retournent
     littéralement « 1 action » : on refuse alors la donnée au lieu de l'écrire.

CHOIX DU CONCEPT XBRL — vérifié contre les chiffres de la rédaction :
  `us-gaap:CommonStockSharesOutstanding` est daté à la CLÔTURE COMPTABLE.
  `dei:EntityCommonStockSharesOutstanding` est le décompte de PAGE DE GARDE, à
  la date de dépôt (quelques semaines plus tard). Les deux sont justes, ils ne
  mesurent pas la même chose. Contrôle IONQ : us-gaap donne 362 592 722 au
  31/12/2025 et 373 171 320 au 31/03/2026 — les chiffres validés ; dei donne
  366 640 756 et 373 269 948, impossibles à aligner sur des exercices.
  → `dei` n'est JAMAIS utilisé pour l'historique.
"""

from __future__ import annotations

import gzip
import json
import logging
import time
import urllib.error
import urllib.request
from datetime import date, datetime
from pathlib import Path
from typing import Any, Optional

logger = logging.getLogger(__name__)

# ─────────────────────────── Politique d'accès SEC ───────────────────────────

# Contact identifiable exigé par la politique d'accès de la SEC.
USER_AGENT = "The Quantum Wall / L'Investisseuse Quantique (sqywallet@gmail.com)"

_MIN_INTERVAL = 0.12   # s entre deux requêtes → < 10 req/s avec de la marge
_MAX_ATTEMPTS = 3
_BACKOFF_BASE = 2      # tentative n attend backoff_base^n secondes

# Cache disque : companyfacts pèse ~1 Mo par société. Un backfill relancé après
# un ajustement de règle ne doit pas re-télécharger 13 fichiers pour rien.
CACHE_DIR = Path(__file__).parent / ".edgar_cache"

_last_request_at = 0.0


def _throttle() -> None:
    """Sérialise les appels réseau sous la limite SEC de 10 req/s."""
    global _last_request_at
    delta = time.monotonic() - _last_request_at
    if delta < _MIN_INTERVAL:
        time.sleep(_MIN_INTERVAL - delta)
    _last_request_at = time.monotonic()


def _retry(func):
    """Décorateur : 3 tentatives avec backoff exponentiel (idem market_data)."""
    def wrapper(*args, **kwargs):
        last_exc: Optional[Exception] = None
        for attempt in range(_MAX_ATTEMPTS):
            try:
                return func(*args, **kwargs)
            except Exception as exc:
                last_exc = exc
                wait = _BACKOFF_BASE ** attempt
                logger.warning(
                    "EDGAR — tentative %d/%d échouée pour %s : %s — retry dans %ds",
                    attempt + 1, _MAX_ATTEMPTS, args, exc, wait,
                )
                time.sleep(wait)
        raise RuntimeError(f"Échec EDGAR après {_MAX_ATTEMPTS} tentatives") from last_exc
    return wrapper


@_retry
def fetch_json(url: str, cache_key: str | None = None) -> dict[str, Any]:
    """
    GET JSON sur un point d'entrée SEC, avec throttle, User-Agent et cache disque.

    Brique générique : c'est cette fonction que S8 réutilisera pour tout autre
    fournisseur public. `cache_key` absent = aucun cache (données volatiles).
    """
    cache_file = CACHE_DIR / f"{cache_key}.json" if cache_key else None
    if cache_file is not None and cache_file.exists():
        return json.loads(cache_file.read_text())

    _throttle()
    req = urllib.request.Request(
        url, headers={"User-Agent": USER_AGENT, "Accept-Encoding": "gzip, deflate"}
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        raw = resp.read()
        if resp.headers.get("Content-Encoding") == "gzip":
            raw = gzip.decompress(raw)

    payload = json.loads(raw)
    if cache_file is not None:
        CACHE_DIR.mkdir(exist_ok=True)
        cache_file.write_text(json.dumps(payload))
    return payload


def clear_cache() -> None:
    """Vide le cache disque — à appeler pour forcer une relecture chez la SEC."""
    if not CACHE_DIR.exists():
        return
    for f in CACHE_DIR.glob("*.json"):
        f.unlink()


# ─────────────────────────────── Identifiants ────────────────────────────────

# Carte ticker → CIK, vérifiée le 2026-08-15 contre
# https://www.sec.gov/files/company_tickers.json (les 13 tickers y figurent).
# En dur et non résolue à l'exécution : un CIK ne change pas, et une résolution
# par ticker casserait le jour où un ticker est réattribué à une autre société
# (piège déjà rencontré avec IQM → Franklin Intelligent Machines ETF).
TICKER_CIK: dict[str, int] = {
    "GOOGL": 1652044,
    "IBM":     51143,
    "IONQ":  1824920,
    "QBTS":  1907982,
    "RGTI":  1838359,
    "QUBT":  1758009,
    "ARQQ":  1859690,
    "LAES":  1951222,
    "QNT":   2110105,
    "XNDU":  2097163,
    "INFQ":  2007825,
    "HQ":    2088256,
    "IQMX":  2113060,
}


def filing_url(cik: int, accession: str) -> str:
    """Lien canonique vers l'index d'un dépôt — toute source affichée passe par ici."""
    acc = accession.replace("-", "")
    return f"https://www.sec.gov/Archives/edgar/data/{cik}/{acc}/{accession}-index.htm"


def fetch_submissions(cik: int) -> dict[str, Any]:
    """Métadonnées de l'émetteur + historique récent des dépôts."""
    return fetch_json(
        f"https://data.sec.gov/submissions/CIK{cik:010d}.json", cache_key=f"subs_{cik}"
    )


def fetch_company_facts(cik: int) -> dict[str, Any]:
    """Tous les faits XBRL déclarés par l'émetteur."""
    return fetch_json(
        f"https://data.sec.gov/api/xbrl/companyfacts/CIK{cik:010d}.json",
        cache_key=f"facts_{cik}",
    )


# ───────────────────────── Nombre d'actions — historique ─────────────────────

# Formes annuelles acceptées. 10-K (émetteurs US), 20-F (émetteurs privés
# étrangers), 40-F (régime canadien MJDS) et leurs amendements.
ANNUAL_FORMS = {"10-K", "10-K/A", "20-F", "20-F/A", "40-F", "40-F/A"}

# Ordre de repli des concepts. `dei` volontairement absent (voir en-tête).
SHARE_CONCEPTS: list[tuple[str, str]] = [
    ("us-gaap", "CommonStockSharesOutstanding"),
    ("ifrs-full", "NumberOfSharesOutstanding"),   # émetteurs IFRS (ARQQ)
    ("us-gaap", "CommonStockSharesIssued"),       # dernier recours, ≠ outstanding
]

# En deçà de cet écart relatif, deux valeurs pour une même date sont le même
# chiffre à l'arrondi de présentation près (QUBT publie 55 963 334 puis
# 55 963 000). On garde alors la plus PRÉCISE, pas la plus récente.
_ROUNDING_TOLERANCE = 0.005

# Un nombre d'actions plausible. En dessous, c'est un artefact de tagging :
# XNDU et HQ déclarent littéralement « 1 » (ventilation par classe perdue par
# companyfacts). On refuse la donnée plutôt que d'écrire une absurdité.
_MIN_PLAUSIBLE_SHARES = 10_000

# Même garde-fou côté montants : HQ déclare une trésorerie de 0 et un flux de −1.
# Ce sont des valeurs de remplissage de dépôt, pas des mesures.
_MIN_PLAUSIBLE_AMOUNT = 1_000

# Durée d'un trimestre calendaire moyen (365,25 / 4) — sert à ramener au
# trimestre une période publiée de durée quelconque.
_QUARTER_DAYS = 91.3125


def _trailing_zeros(value: int) -> int:
    """Nombre de zéros terminaux — proxy du niveau d'arrondi d'une valeur publiée."""
    s = str(abs(value))
    return len(s) - len(s.rstrip("0"))


def annual_share_counts(cik: int) -> dict[str, Any]:
    """
    Série annuelle du nombre d'actions, AJUSTÉE des splits, telle que déposée.

    Retourne :
      {
        'concept':  'us-gaap:CommonStockSharesOutstanding' | ... | None,
        'points':   [ { 'as_of_date': date, 'shares': int, 'form': str,
                        'filed': date, 'accession': str,
                        'restated_from': int | None,   # valeur d'origine si retraitée
                        'ratio': float | None } ],     # ratio de split détecté
        'rejected': [ str ],   # motifs de refus, à afficher tels quels
      }

    AJUSTEMENT DES SPLITS — mécanisme central, ne pas « re-simplifier » :
    on ne multiplie RIEN. À date de clôture égale, on retient la valeur du dépôt
    LE PLUS RÉCENT. Après un regroupement d'actions, l'émetteur retraite ses
    comparatifs : la série devient homogène d'elle-même. Vérifié sur ARQQ, dont
    le 30/09/2021 porte 110 073 430 (20-F déposé en 2021) ET 4 402 937 (20-F
    déposé en 2024) — ratio exact 25,0, le regroupement 25:1 documenté.
    Retenir le premier dépôt afficherait une chute de −93 % qui n'a jamais eu lieu.
    """
    facts = fetch_company_facts(cik)
    subs = fetch_submissions(cik)
    fye = subs.get("fiscalYearEnd")  # 'MMDD' — clôture déclarée par l'émetteur
    rejected: list[str] = []

    if not fye:
        return {"concept": None, "points": [], "rejected": ["clôture d'exercice non déclarée"]}

    # Index accession par (form, filed) pour retrouver le dépôt d'un fait.
    recent = subs.get("filings", {}).get("recent", {})
    acc_by_key: dict[tuple[str, str], str] = {}
    for i in range(len(recent.get("form", []))):
        acc_by_key.setdefault(
            (recent["form"][i], recent["filingDate"][i]), recent["accessionNumber"][i]
        )

    for tax, concept in SHARE_CONCEPTS:
        node = facts.get("facts", {}).get(tax, {}).get(concept)
        if not node:
            continue

        rows = [r for unit in node["units"].values() for r in unit]
        # Seuls les dépôts ANNUELS, et seulement à la clôture d'exercice déclarée.
        # Ce filtre élimine gratuitement les faits parasites (ARQQ porte un point
        # « 1 action » au 26/04/2021 qui disparaît de lui-même).
        annual = [
            r for r in rows
            if r.get("form") in ANNUAL_FORMS
            and r.get("end", "")[5:7] + r.get("end", "")[8:10] == fye
        ]
        if not annual:
            continue

        by_date: dict[str, dict] = {}
        first_filed: dict[str, dict] = {}
        for r in sorted(annual, key=lambda r: r.get("filed", "")):
            end = r["end"]
            first_filed.setdefault(end, r)
            prev = by_date.get(end)
            if prev is None:
                by_date[end] = r
                continue
            # Écart d'arrondi seul → on garde la valeur la plus PRÉCISE (QUBT
            # republie 55 963 334 en 55 963 000 : le dépôt récent est moins bon).
            base = max(abs(prev["val"]), abs(r["val"]), 1)
            if abs(prev["val"] - r["val"]) / base < _ROUNDING_TOLERANCE:
                if _trailing_zeros(r["val"]) < _trailing_zeros(prev["val"]):
                    by_date[end] = r
            else:
                by_date[end] = r  # dépôt plus récent → comparatif retraité

        points = []
        for end in sorted(by_date):
            r = by_date[end]
            val = int(r["val"])
            if val < _MIN_PLAUSIBLE_SHARES:
                motif = (
                    f"{end} — valeur invraisemblable ({val}) : ventilation par classe "
                    f"perdue par companyfacts, donnée refusée"
                )
                if motif not in rejected:   # un même point est refusé par chaque concept testé
                    rejected.append(motif)
                continue
            orig = int(first_filed[end]["val"])
            base = max(abs(orig), abs(val), 1)
            restated = abs(orig - val) / base >= _ROUNDING_TOLERANCE
            points.append({
                "as_of_date": date.fromisoformat(end),
                "shares": val,
                "form": r.get("form", ""),
                "filed": date.fromisoformat(r["filed"]),
                "accession": acc_by_key.get((r.get("form", ""), r.get("filed", "")), ""),
                "restated_from": orig if restated else None,
                "ratio": round(orig / val, 6) if restated and val else None,
            })

        if points:
            return {"concept": f"{tax}:{concept}", "points": points, "rejected": rejected}

    rejected.append("aucun concept XBRL d'actions exploitable dans companyfacts")
    return {"concept": None, "points": [], "rejected": rejected}


# ──────────────────────── Trésorerie et consommation ─────────────────────────

_CASH_CONCEPTS = [
    ("us-gaap", "CashAndCashEquivalentsAtCarryingValue"),
    ("ifrs-full", "CashAndCashEquivalents"),
]

# ═══════════════════ RESSOURCES LIQUIDES — deux règles dures ═════════════════
#
# RÈGLE 1 — LE LONG TERME COMPTE. Ne retenir que trésorerie + placements
# COURANTS sous-estime massivement les ressources : ces sociétés échelonnent
# leur portefeuille obligataire au-delà de 12 mois. Constaté le 2026-08-16 sur
# le 10-Q du 30/06/2026 :
#   · RGTI  → 27,8 M$ au lieu de 541,3 M$  (les 147,6 M$ non courants ET les
#             365,9 M$ courants manquaient : mauvais nom de tag, voir règle 2)
#   · IONQ  → 2 119 M$ au lieu de 2 959 M$ (les 840,4 M$ non courants manquaient)
# Un runway calculé là-dessus donnait ~2 trimestres à RGTI, société qui n'a
# aucune dette et plus de 500 M$ : une fausse alerte publiée aurait été pire
# qu'une absence de chiffre. Le runway se définit sur les ressources TOTALES.
#
# RÈGLE 2 — UNE SEULE VALEUR PAR SEAU, JAMAIS DE SOMME DE SYNONYMES. Les tags
# d'un même seau sont des dénominations CONCURRENTES du même poste, pas des
# composantes à additionner. QBTS publie au 30/06/2026 `MarketableSecuritiesCurrent`
# = 249,573 M$ ET `DebtSecuritiesAvailableForSaleExcludingAccruedInterestCurrent`
# = 249,600 M$ : c'est la même ligne de bilan, à l'intérêt couru près. Les
# additionner doublerait le poste. On résout donc chaque seau par ORDRE DE
# PRIORITÉ, premier tag trouvé, et on affiche lequel a servi.
#
# Vérifié TAG PAR TAG sur les 13 sociétés (sonde companyfacts du 2026-08-16) :
#   IONQ  courant ShortTermInvestments · non courant LongTermInvestments
#   QBTS  courant MarketableSecuritiesCurrent · non courant LongTermInvestments
#   RGTI  courant + non courant DebtSecuritiesAvailableForSaleExcludingAccruedInterest*
#   QUBT  courant ShortTermInvestments · non courant LongTermInvestments
#   LAES  courant ShortTermInvestments · non courant AvailableForSaleSecuritiesDebtSecuritiesNoncurrent
#   INFQ  courant + non courant AvailableForSaleSecuritiesDebtSecurities*
#   QNT · XNDU  trésorerie seule (aucun placement déclaré)
#   ARQQ (IFRS) trésorerie seule · HQ valeurs de remplissage · IQMX aucun fait
#
# JAMAIS D'AGRÉGAT DE PORTEFEUILLE. `AvailableForSaleSecuritiesDebtSecurities`
# et `DebtSecuritiesAvailableForSaleAmortizedCost*` (sans suffixe Current /
# Noncurrent) totalisent le portefeuille AFS **y compris les titres classés en
# équivalents de trésorerie**. Chez IONQ ce total vaut 2 966,9 M$ alors que
# courant + non courant ne font que 1 723,6 M$ : l'ajouter à la trésorerie
# double-compterait 1,2 G$. Ces tags sont exclus par construction.
_INVEST_CURRENT_CONCEPTS = [
    ("us-gaap", "ShortTermInvestments"),
    ("us-gaap", "MarketableSecuritiesCurrent"),
    ("us-gaap", "AvailableForSaleSecuritiesDebtSecuritiesCurrent"),
    ("us-gaap", "DebtSecuritiesAvailableForSaleExcludingAccruedInterestCurrent"),
    ("ifrs-full", "CurrentInvestments"),
]
_INVEST_NONCURRENT_CONCEPTS = [
    ("us-gaap", "LongTermInvestments"),
    ("us-gaap", "MarketableSecuritiesNoncurrent"),
    ("us-gaap", "AvailableForSaleSecuritiesDebtSecuritiesNoncurrent"),
    ("us-gaap", "DebtSecuritiesAvailableForSaleExcludingAccruedInterestNoncurrent"),
    ("us-gaap", "OtherLongTermInvestments"),
    ("ifrs-full", "NoncurrentInvestments"),
]

_OPERATING_CF_CONCEPTS = [
    ("us-gaap", "NetCashProvidedByUsedInOperatingActivities"),
    ("ifrs-full", "CashFlowsFromUsedInOperatingActivities"),
]


def _latest_instant(facts: dict, concepts: list[tuple[str, str]]) -> Optional[dict]:
    """Dernier point ponctuel (bilan) parmi une liste de concepts équivalents."""
    best: Optional[dict] = None
    for tax, concept in concepts:
        node = facts.get("facts", {}).get(tax, {}).get(concept)
        if not node:
            continue
        for r in (r for unit in node["units"].values() for r in unit):
            if "start" in r:      # période, pas un instant de bilan
                continue
            if best is None or (r["end"], r.get("filed", "")) > (best["end"], best.get("filed", "")):
                best = r
    return best


def quarterly_cash_and_burn(cik: int) -> dict[str, Any]:
    """
    Trésorerie, placements court terme et consommation de cash ramenée au trimestre.

    PIÈGE XBRL n°1 — les flux de trésorerie sont CUMULÉS depuis l'ouverture de
    l'exercice : T1 couvre ~89 jours, T2 ~180, T3 ~272, l'exercice ~364. Lire
    « le flux du T2 » revient à lire un semestre, donc à diviser le burn par deux.

    PIÈGE XBRL n°2 — et c'est celui qui a coûté une réécriture : on ne peut PAS
    reconstituer un trimestre en soustrayant deux cumuls consécutifs, parce que
    ces cumuls proviennent de DÉPÔTS DIFFÉRENTS, qui peuvent reposer sur des
    bases retraitées. Constaté sur INFQ : le T1 2025 vaut −757 617 dans le 10-Q
    d'août 2025 et −6 972 000 après retraitement dans celui de mai 2026.
    Soustraire l'un de l'autre fabriquait un trimestre à **+6,2 M$ de cash
    généré** pour une société qui n'a jamais rien généré. Un chiffre faux, de
    signe inverse, produit par une arithmétique correcte sur des bases
    incohérentes — exactement le genre d'erreur qui survit à la relecture.

    RÈGLE RETENUE : une seule période, issue d'un seul dépôt, ramenée au
    trimestre par sa propre durée. Aucune soustraction entre dépôts. La période
    de calcul est retournée et AFFICHÉE — le lecteur voit sur quoi le chiffre
    est établi. Effet secondaire heureux : cela marche aussi pour les émetteurs
    IFRS qui ne publient qu'en semestriel ou en annuel (ARQQ, LAES).

    Retourne { cash, invest_current, invest_noncurrent, liquidity, concepts_used,
               as_of, burn_per_quarter, period_start, period_end, period_days,
               source_form, source_filed }
    ou des None quand la donnée manque (jamais d'estimation).

    `liquidity` est la somme des RESSOURCES LIQUIDES TOTALES — trésorerie +
    placements courants + placements non courants (voir les deux règles dures
    au-dessus des listes de concepts). C'est cette somme, et elle seule, qui
    sert de numérateur au runway.

    `concepts_used` nomme le tag XBRL retenu pour chaque seau : le tableau de
    contrôle l'affiche, pour qu'un écart au communiqué se diagnostique sans
    rouvrir le code.
    """
    facts = fetch_company_facts(cik)
    empty = {"cash": None, "invest_current": None, "invest_noncurrent": None,
             "liquidity": None, "concepts_used": {}, "divergent_tags": [], "as_of": None,
             "burn_per_quarter": None, "period_start": None, "period_end": None,
             "period_days": None, "source_form": None, "source_filed": None,
             "source_accession": None, "source_url": None}

    cash_row = _latest_instant(facts, _CASH_CONCEPTS)
    # HQ déclare une trésorerie de 0 et un flux de −1 : des valeurs de remplissage,
    # pas des mesures. On refuse plutôt que d'afficher un runway de zéro trimestre.
    if cash_row is None or int(cash_row["val"]) < _MIN_PLAUSIBLE_AMOUNT:
        return empty

    as_of = cash_row["end"]
    concepts_used: dict[str, str] = {"cash": _concept_name(facts, cash_row, _CASH_CONCEPTS)}

    current, c_tag, c_div = _first_at_date(facts, _INVEST_CURRENT_CONCEPTS, as_of)
    noncurrent, nc_tag, nc_div = _first_at_date(facts, _INVEST_NONCURRENT_CONCEPTS, as_of)
    if c_tag:
        concepts_used["invest_current"] = c_tag
    if nc_tag:
        concepts_used["invest_noncurrent"] = nc_tag

    cash = int(cash_row["val"])
    period = _latest_cumulative_period(facts)

    burn = None
    if period is not None and abs(period["val"]) >= _MIN_PLAUSIBLE_AMOUNT:
        # Normalisation au trimestre par la durée RÉELLE de la période publiée.
        burn = round(period["val"] * _QUARTER_DAYS / period["days"])

    return {
        "cash": cash,
        "invest_current": current,
        "invest_noncurrent": noncurrent,
        "liquidity": cash + (current or 0) + (noncurrent or 0),
        "concepts_used": concepts_used,
        "divergent_tags": c_div + nc_div,
        "as_of": date.fromisoformat(as_of),
        "burn_per_quarter": burn,
        "period_start": date.fromisoformat(period["start"]) if period else None,
        "period_end": date.fromisoformat(period["end"]) if period else None,
        "period_days": period["days"] if period else None,
        "source_form": cash_row.get("form"),
        "source_filed": cash_row.get("filed"),
        # Accession du dépôt d'où sort la trésorerie → lien canonique vers la
        # source. Aucun chiffre financier n'est publié sans son dépôt d'origine.
        "source_accession": cash_row.get("accn"),
        "source_url": filing_url(cik, cash_row["accn"]) if cash_row.get("accn") else None,
    }


def _concept_name(facts: dict, row: dict, concepts: list[tuple[str, str]]) -> str:
    """Retrouve le nom du concept dont provient un fait déjà sélectionné."""
    for tax, concept in concepts:
        node = facts.get("facts", {}).get(tax, {}).get(concept)
        if not node:
            continue
        for r in (r for unit in node["units"].values() for r in unit):
            if r is row:
                return f"{tax}:{concept}"
    return "?"


# Deux tags d'un même seau qui divergent de plus de ça ne sont pas des synonymes :
# la priorité en retiendrait un et perdrait la différence, en silence. Constaté
# bénin chez QBTS (249,573 vs 249,600 M$, soit 0,01 % — l'intérêt couru).
_SYNONYM_TOLERANCE = 0.02


def _first_at_date(
    facts: dict, concepts: list[tuple[str, str]], as_of: str
) -> tuple[Optional[int], Optional[str], list[tuple[str, int]]]:
    """
    Premier concept RENSEIGNÉ de la liste, à la date `as_of` — jamais de somme.

    Deux garde-fous, tous deux déjà pris en défaut en conditions réelles :
      · **même date que la trésorerie**, sinon on additionnerait deux photos de
        bilan différentes ;
      · **ordre de priorité, premier trouvé**, parce que les tags d'un même seau
        sont des synonymes concurrents et non des composantes (cf. règle 2).
    À date égale et concept égal, on retient le dépôt le plus récent.

    Troisième valeur retournée : les tags CONCURRENTS du même seau qui s'écartent
    de plus de `_SYNONYM_TOLERANCE` du retenu. La priorité n'est légitime que
    tant que les tags d'un seau disent la même chose ; le jour où une société
    change de convention de balisage, cette liste le dit au lieu de laisser
    l'écart disparaître. Elle est affichée par le tableau de contrôle.
    """
    chosen: Optional[int] = None
    chosen_tag: Optional[str] = None
    divergent: list[tuple[str, int]] = []

    for tax, concept in concepts:
        node = facts.get("facts", {}).get(tax, {}).get(concept)
        if not node:
            continue
        same_date = [
            r for r in (r for unit in node["units"].values() for r in unit)
            if "start" not in r and r["end"] == as_of
        ]
        if not same_date:
            continue
        val = int(max(same_date, key=lambda r: r.get("filed", ""))["val"])
        if chosen is None:
            chosen, chosen_tag = val, f"{tax}:{concept}"
        elif abs(val - chosen) / max(abs(chosen), 1) > _SYNONYM_TOLERANCE:
            divergent.append((f"{tax}:{concept}", val))

    return chosen, chosen_tag, divergent


def _latest_cumulative_period(facts: dict) -> Optional[dict]:
    """
    Période de flux d'exploitation publiée la plus récente — un seul fait, un seul dépôt.

    Sélection : la date de fin la plus récente ; à égalité, la période la plus
    LONGUE (elle lisse davantage), puis le dépôt le plus récent. Aucune
    soustraction entre dépôts (voir le piège n°2 en tête de `quarterly_cash_and_burn`).
    """
    rows: list[dict] = []
    for tax, concept in _OPERATING_CF_CONCEPTS:
        node = facts.get("facts", {}).get(tax, {}).get(concept)
        if node:
            rows = [r for unit in node["units"].values() for r in unit if "start" in r]
            break
    if not rows:
        return None

    scored = []
    for r in rows:
        days = (datetime.fromisoformat(r["end"]) - datetime.fromisoformat(r["start"])).days
        if days < 60:            # trop court pour lisser quoi que ce soit
            continue
        scored.append({**r, "days": days})
    if not scored:
        return None

    return max(scored, key=lambda r: (r["end"], r["days"], r.get("filed", "")))


# ─────────────────────── Dépôts déclarés (signaux factuels) ──────────────────

# Formes retenues comme signaux de financement potentiel. Chacune est nommée par
# sa FORME EXACTE à l'affichage — jamais qualifiée d'« ATM » : ce serait une
# inférence, et la règle §10 interdit d'habiller un fait en interprétation.
# 424B3 (prospectus de REVENTE par des porteurs existants) est volontairement
# EXCLU : ce n'est pas une émission de titres nouveaux par la société.
SHELF_FORMS = ("S-3", "S-3ASR", "F-3", "F-3ASR", "424B5")


def recent_filings(cik: int, forms: tuple[str, ...], limit: int = 3) -> list[dict]:
    """Derniers dépôts d'une ou plusieurs formes, du plus récent au plus ancien."""
    subs = fetch_submissions(cik)
    recent = subs.get("filings", {}).get("recent", {})
    out: list[dict] = []
    for i in range(len(recent.get("form", []))):
        if recent["form"][i] not in forms:
            continue
        out.append({
            "form": recent["form"][i],
            "filed": date.fromisoformat(recent["filingDate"][i]),
            "accession": recent["accessionNumber"][i],
            "url": filing_url(cik, recent["accessionNumber"][i]),
        })
    out.sort(key=lambda f: f["filed"], reverse=True)
    return out[:limit]
