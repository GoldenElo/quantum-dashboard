"""
Moteur de l'Indice TQW (C3) — univers, plafond, diviseur, valeur quotidienne.

Module ISOLÉ (comme market_data.py et guards.py) : TOUTE la méthodologie de
l'indice vit ici. ingest.py, backfill_index.py et check_index.py l'importent ;
aucun d'eux ne réimplémente une règle. Un changement de méthodologie se fait
dans ce fichier et dans docs/methodologie-indice-tqw.fr.md — nulle part ailleurs.

Méthodologie publiée : docs/methodologie-indice-tqw.fr.md

  Indice(t) = Σ [ actions(i,R) × cap_factor(i,R) × adj_close(i,t) ] / diviseur(R)

où R est le dernier rebalancement : actions et cap_factor y sont FIGÉS, seul le
cours varie au jour le jour. Les poids dérivent donc librement entre deux
rebalancements — c'est voulu, un indice qui réécrête en continu serait un
portefeuille géré.

Règles dures :
  - Univers = asset.category = 'pure_player' (activité principale = quantique).
  - Entrée au 1er rebalancement suivant 30 séances cotées (anti-données-fantômes).
  - Pondération par capitalisation TOTALE (non flottante) — QNT en pleinement dilué.
  - Plafond de 25 % appliqué AU REBALANCEMENT UNIQUEMENT.
  - Rebalancement : 1re séance ≥ 1er février / mai / août / novembre.
  - Le diviseur absorbe entrées, sorties et changements de plafond → continuité parfaite.
  - NON-RÉTROACTIVITÉ : une valeur publiée n'est jamais recalculée.

Usage : ce module ne s'exécute pas seul.
  - calcul quotidien   : appelé par ingest.py (étape 5)
  - reconstruction     : cd scripts && python3 backfill_index.py
  - contrôle (lecture) : cd scripts && python3 check_index.py
"""

from __future__ import annotations

import logging
from datetime import date

from supabase import Client

from guards import emit_error, emit_warning

logger = logging.getLogger(__name__)

# ─── Paramètres de méthodologie (figés — toute évolution se documente) ───────

INDEX_INCEPTION = date(2026, 6, 1)   # base 100 — même date que l'inception des portefeuilles
INDEX_BASE_VALUE = 100.0
WEIGHT_CAP = 0.25                    # plafond par valeur, appliqué au rebalancement seulement
MIN_SESSIONS = 30                    # séances cotées requises avant l'entrée dans l'univers
REBALANCE_MONTHS = (2, 5, 8, 11)     # aligné sur le cron trimestriel des fondamentaux
PURE_PLAYER_CATEGORY = "pure_player"

# Un constituant sans cotation un jour de séance voit son dernier cours reporté.
# Au-delà de ce nombre de séances consécutives, on refuse de publier une valeur :
# mieux vaut pas de valeur qu'une valeur fausse (cohérent « jamais de snapshot partiel »).
MAX_STALE_SESSIONS = 5

BATCH_SIZE = 500
_PAGE_SIZE = 1000  # PostgREST plafonne toute réponse à max-rows (1000 par défaut)

# Précision de stockage. On ARRONDIT AVANT de calculer le diviseur et les valeurs :
# les paramètres réellement écrits en base doivent reproduire exactement les valeurs
# écrites en base (sinon check_index.py signalerait une dérive à chaque exécution).
_PRICE_DP = 6
_WEIGHT_DP = 10
_FACTOR_DP = 10
_VALUE_DP = 6
_DIVISOR_DP = 6


# ─── Lecture de la base ──────────────────────────────────────────────────────

def load_universe(db: Client) -> list[str]:
    """
    Univers candidat = asset.category = 'pure_player'.

    L'univers est défini EN BASE, pas par une liste en dur : c'est la traduction
    mécanique de la règle « société cotée sur une place majeure dont l'activité
    principale est le quantique ». Les conglomérats diversifiés (GOOGL, IBM),
    l'infrastructure (NVDA) et les ETF (QNTM.L, QQQ) en sont exclus par leur
    catégorie, sans exception écrite nulle part.
    """
    res = (
        db.table("asset")
        .select("ticker")
        .eq("category", PURE_PLAYER_CATEGORY)
        .order("ticker")
        .execute()
    )
    return [row["ticker"] for row in (res.data or [])]


def load_prices(db: Client, tickers: list[str]) -> dict[str, dict[date, float]]:
    """
    {ticker: {date: adj_close}} pour l'univers candidat, lu par pagination .range().

    Pagination obligatoire : l'historique sectoriel remonte au 01/06/2025 pour
    13 tickers — un .limit() serait silencieusement tronqué à 1000 lignes par
    PostgREST et produirait un indice faux sans aucune alerte.
    """
    out: dict[str, dict[date, float]] = {t: {} for t in tickers}
    offset = 0
    while True:
        res = (
            db.table("price_daily")
            .select("ticker, date, adj_close")
            .in_("ticker", tickers)
            .order("date", desc=False)
            .order("ticker", desc=False)
            .range(offset, offset + _PAGE_SIZE - 1)
            .execute()
        )
        batch = res.data or []
        for row in batch:
            out[row["ticker"]][date.fromisoformat(row["date"])] = float(row["adj_close"])
        if len(batch) < _PAGE_SIZE:
            break
        offset += _PAGE_SIZE
    return out


def load_shares_history(db: Client, tickers: list[str]) -> dict[str, list[dict]]:
    """{ticker: [{as_of_date, shares, source}, …]} trié par as_of_date CROISSANTE."""
    res = (
        db.table("shares_outstanding")
        .select("ticker, as_of_date, shares, source")
        .in_("ticker", tickers)
        .order("as_of_date", desc=False)
        .execute()
    )
    out: dict[str, list[dict]] = {t: [] for t in tickers}
    for row in res.data or []:
        out[row["ticker"]].append(row)
    return out


def load_index_daily(db: Client) -> dict[date, dict]:
    """{date: {value, divisor}} — série déjà publiée."""
    res = db.table("index_daily").select("date, value, divisor").order("date").execute()
    return {
        date.fromisoformat(r["date"]): {"value": float(r["value"]), "divisor": float(r["divisor"])}
        for r in (res.data or [])
    }


def load_index_weights(db: Client) -> dict[date, list[dict]]:
    """{rebalance_date: [lignes de composition]} — rebalancements déjà figés."""
    res = (
        db.table("index_weights")
        .select("rebalance_date, ticker, shares, price, weight_raw, weight_capped, "
                "cap_factor, shares_source")
        .order("rebalance_date")
        .execute()
    )
    out: dict[date, list[dict]] = {}
    for row in res.data or []:
        out.setdefault(date.fromisoformat(row["rebalance_date"]), []).append(row)
    return out


# ─── Règles de méthodologie (fonctions pures — testables sans base) ──────────

def apply_cap(market_caps: dict[str, float], cap: float = WEIGHT_CAP) -> dict[str, float]:
    """
    Plafonnement par waterfall itératif — fonction PURE.

    Les valeurs au-dessus du plafond y sont ramenées, l'excédent est redistribué
    au prorata sur les autres, on itère jusqu'à convergence (un écrêtage peut en
    provoquer un autre : au 01/06/2026, écrêter IONQ fait passer QBTS au-dessus
    de 25 %, d'où deux tours).

    Retourne {ticker: poids} sommant à 1.0.
    """
    total = sum(market_caps.values())
    if total <= 0:
        raise ValueError("Capitalisation totale nulle — plafonnement impossible.")

    weights = {t: mc / total for t, mc in market_caps.items()}
    n = len(weights)

    # Plafond mathématiquement inatteignable (trop peu de constituants) : le seul
    # résultat cohérent est l'équipondération. Ne peut pas arriver au-delà de
    # 4 constituants avec un plafond de 25 %, mais on ne boucle pas à l'infini.
    if n * cap < 1.0 - 1e-12:
        return {t: 1.0 / n for t in weights}

    capped: set[str] = set()
    for _ in range(n + 1):
        free = [t for t in weights if t not in capped]
        free_raw = sum(weights[t] for t in free)
        remaining = 1.0 - cap * len(capped)
        scale = remaining / free_raw if free_raw > 0 else 0.0
        over = [t for t in free if weights[t] * scale > cap + 1e-12]
        if not over:
            return {t: (cap if t in capped else weights[t] * scale) for t in weights}
        capped.update(over)

    raise RuntimeError("Plafonnement non convergent — méthodologie à revoir.")


def cap_factors(raw_weights: dict[str, float], capped_weights: dict[str, float]) -> dict[str, float]:
    """
    facteur(i) = poids_plafonné(i) / poids_brut(i), normalisé pour que le max vaille 1,0.

    La normalisation est intégralement absorbée par le diviseur : elle ne change
    aucune valeur d'indice. Elle rend seulement les facteurs lisibles — une valeur
    non écrêtée porte 1,0, une valeur écrêtée porte moins.
    """
    factors = {t: capped_weights[t] / raw_weights[t] for t in raw_weights}
    top = max(factors.values())
    return {t: f / top for t, f in factors.items()}


def shares_asof(history: list[dict], on: date) -> dict | None:
    """
    Dernière ligne shares_outstanding dont as_of_date ≤ `on` (fonction en escalier).

    Port fidèle du step-function de src/lib/api.ts, y compris son approximation
    documentée : à défaut de relevé antérieur, le plus ancien connu est appliqué
    rétroactivement. Une surcharge manuelle sanctuarisée (source 'SEC…') prime
    naturellement, puisqu'elle porte une as_of_date plus récente.
    """
    if not history:
        return None
    applicable = history[0]
    for row in history:
        if date.fromisoformat(row["as_of_date"]) <= on:
            applicable = row
        else:
            break
    return applicable


def sessions_before(prices: dict[date, float], on: date) -> int:
    """Nombre de séances cotées STRICTEMENT avant `on` (règle des 30 séances)."""
    return sum(1 for d in prices if d < on)


def eligible_universe(
    candidates: list[str],
    prices: dict[str, dict[date, float]],
    shares: dict[str, list[dict]],
    on: date,
) -> tuple[list[str], dict[str, str]]:
    """
    Univers éligible à la date `on` → (tickers retenus, {ticker: motif d'exclusion}).

    Trois conditions cumulatives : ≥ 30 séances cotées révolues, un cours
    disponible à la date du rebalancement, et un nombre d'actions connu.
    """
    retained: list[str] = []
    rejected: dict[str, str] = {}
    for ticker in candidates:
        series = prices.get(ticker) or {}
        n = sessions_before(series, on)
        if n < MIN_SESSIONS:
            rejected[ticker] = f"{n} séance(s) cotée(s) < {MIN_SESSIONS} requises"
            continue
        if not any(d <= on for d in series):
            rejected[ticker] = "aucun cours disponible"
            continue
        if shares_asof(shares.get(ticker) or [], on) is None:
            rejected[ticker] = "nombre d'actions inconnu"
            continue
        retained.append(ticker)
    return retained, rejected


def scheduled_rebalances(sessions: list[date], base: date, upto: date) -> list[date]:
    """
    Dates EFFECTIVES de rebalancement entre `base` et `upto`.

    L'inception est le premier rebalancement. Ensuite : la 1re séance cotée à
    partir du 1er février / mai / août / novembre (les 1ers tombant souvent un
    week-end — le 1er août 2026 est un samedi, le rebalancement prend effet le
    lundi 3 août).
    """
    dates = [base]
    for year in range(base.year, upto.year + 1):
        for month in REBALANCE_MONTHS:
            first = date(year, month, 1)
            if first <= base or first > upto:
                continue
            effective = next((s for s in sessions if s >= first), None)
            if effective is not None and effective <= upto and effective not in dates:
                dates.append(effective)
    return sorted(dates)


def index_value(weights: list[dict], closes: dict[str, float], divisor: float) -> float:
    """Indice(t) = Σ [ actions × cap_factor × adj_close(t) ] / diviseur."""
    total = sum(
        float(w["shares"]) * float(w["cap_factor"]) * closes[w["ticker"]]
        for w in weights
    )
    return total / divisor


def build_rebalance(
    on: date,
    universe: list[str],
    closes: dict[str, float],
    shares: dict[str, list[dict]],
) -> list[dict]:
    """
    Compose un rebalancement : capitalisations, poids bruts, plafond, facteurs.

    Les valeurs sont ARRONDIES ICI, à la précision de stockage, pour que les
    paramètres écrits en base reproduisent exactement les valeurs écrites en base.
    """
    market_caps: dict[str, float] = {}
    used_shares: dict[str, dict] = {}
    for ticker in universe:
        row = shares_asof(shares.get(ticker) or [], on)
        if row is None:  # écarté en amont par eligible_universe — ceinture et bretelles
            continue
        used_shares[ticker] = row
        market_caps[ticker] = float(row["shares"]) * closes[ticker]

    total = sum(market_caps.values())
    raw_weights = {t: mc / total for t, mc in market_caps.items()}
    capped_weights = apply_cap(market_caps)
    factors = cap_factors(raw_weights, capped_weights)

    return [
        {
            "rebalance_date": str(on),
            "ticker":         ticker,
            "shares":         int(used_shares[ticker]["shares"]),
            "price":          round(closes[ticker], _PRICE_DP),
            "weight_raw":     round(raw_weights[ticker], _WEIGHT_DP),
            "weight_capped":  round(capped_weights[ticker], _WEIGHT_DP),
            "cap_factor":     round(factors[ticker], _FACTOR_DP),
            "shares_source":  used_shares[ticker]["source"],
        }
        for ticker in sorted(market_caps, key=lambda t: -market_caps[t])
    ]


def divisor_for(weights: list[dict], closes: dict[str, float], target_value: float) -> float:
    """
    Diviseur assurant la CONTINUITÉ : Σ AMC(R) / valeur visée à la date R.

    À l'inception, la valeur visée est 100. À un rebalancement, c'est la valeur de
    l'indice calculée ce même jour avec les ANCIENS paramètres — l'entrée de QNT
    ou d'IQMX ne provoque donc aucun saut.
    """
    total = sum(
        float(w["shares"]) * float(w["cap_factor"]) * closes[w["ticker"]]
        for w in weights
    )
    return round(total / target_value, _DIVISOR_DP)


# ─── Calendrier et cours reportés ────────────────────────────────────────────

def build_calendar(prices: dict[str, dict[date, float]], base: date, upto: date) -> list[date]:
    """
    Calendrier de l'indice = union des séances de l'univers candidat, bornée.

    Tous les constituants sont cotés aux États-Unis : l'union des dates est donc
    le calendrier US. On ne s'appuie sur AUCUN ticker en particulier — un ticker
    de référence sortirait un jour de l'univers et emporterait le calendrier.
    """
    all_dates: set[date] = set()
    for series in prices.values():
        all_dates.update(series)
    return sorted(d for d in all_dates if base <= d <= upto)


def carry_forward(
    series: dict[date, float], calendar: list[date]
) -> tuple[dict[date, float | None], dict[date, int]]:
    """
    Cours par séance avec report du dernier connu → (cours, ancienneté en séances).

    Avant la première cotation du ticker, le cours est None (aucune extrapolation).
    L'ancienneté vaut 0 le jour d'une vraie cotation ; elle sert au garde-fou
    MAX_STALE_SESSIONS.
    """
    closes: dict[date, float | None] = {}
    staleness: dict[date, int] = {}
    last: float | None = None
    stale = 0
    for day in calendar:
        if day in series:
            last = series[day]
            stale = 0
        elif last is not None:
            stale += 1
        closes[day] = last
        staleness[day] = stale
    return closes, staleness


# ─── Orchestrateur ───────────────────────────────────────────────────────────

def _upsert_batched(db: Client, table: str, rows: list[dict]) -> None:
    for i in range(0, len(rows), BATCH_SIZE):
        db.table(table).upsert(rows[i : i + BATCH_SIZE]).execute()


def compute_index(
    db: Client, upto: date, rebuild: bool = False, dry_run: bool = False
) -> dict:
    """
    Calcule et persiste l'Indice TQW jusqu'à `upto`. Idempotent.

    N'écrit QUE les dates manquantes (non-rétroactivité) et ne rebâtit jamais un
    rebalancement déjà figé — sauf `rebuild=True`, réservé à une reconstruction
    délibérée après purge des tables.

    `dry_run=True` : ne persiste rien et rejoue la chaîne complète. C'est ce que
    fait check_index.py pour confronter les valeurs recalculées aux valeurs
    publiées et détecter une dérive (split rétroactif, surcharge rétro-datée) —
    on SIGNALE, on n'écrase jamais.

    Retourne :
      {sessions, series, written, skipped, rebalances, last_value}
    """
    candidates = load_universe(db)
    if not candidates:
        raise RuntimeError("Aucune société pure_player en base — univers vide.")

    prices = load_prices(db, candidates)
    shares = load_shares_history(db, candidates)

    calendar_all = build_calendar(prices, INDEX_INCEPTION, upto)
    if not calendar_all:
        raise RuntimeError(f"Aucune séance entre {INDEX_INCEPTION} et {upto}.")
    base = calendar_all[0]  # 1re séance ≥ inception (le 01/06/2026 est un lundi coté)

    # Cours reportés, une fois pour toutes
    carried: dict[str, dict[date, float | None]] = {}
    stale: dict[str, dict[date, int]] = {}
    for ticker in candidates:
        carried[ticker], stale[ticker] = carry_forward(prices.get(ticker) or {}, calendar_all)

    existing_daily = {} if rebuild else load_index_daily(db)
    existing_weights = {} if rebuild else load_index_weights(db)

    targets = set(scheduled_rebalances(calendar_all, base, upto))

    def closes_for(composition: list[dict], day: date) -> dict[str, float]:
        """Cours des constituants à `day`, avec report et garde-fou d'ancienneté."""
        out: dict[str, float] = {}
        for w in composition:
            ticker = w["ticker"]
            close = carried[ticker][day]
            if close is None:
                raise RuntimeError(f"Cours manquant pour {ticker} au {day} — indice non publiable.")
            age = stale[ticker][day]
            if age > MAX_STALE_SESSIONS:
                emit_error(
                    "Indice TQW — cours périmé",
                    f"{ticker} sans cotation depuis {age} séances au {day}. Aucune valeur "
                    f"d'indice publiée pour cette date (jamais de valeur partielle).",
                )
                raise RuntimeError(f"Cours de {ticker} périmé depuis {age} séances au {day}.")
            if age > 0:
                emit_warning(
                    "Indice TQW — cours reporté",
                    f"{ticker} sans cotation le {day} : dernier cours connu reporté "
                    f"({age} séance(s)).",
                )
            out[ticker] = close
        return out

    series: list[dict] = []
    new_daily: list[dict] = []
    new_weights: list[dict] = []
    summary_rebalances: list[dict] = []

    weights: list[dict] | None = None
    divisor: float | None = None
    last_value: float | None = None

    for day in calendar_all:
        if day in targets:
            # 1. Valeur visée = valeur du jour calculée avec les ANCIENS paramètres.
            #    L'indice bouge donc normalement le jour du rebalancement ; c'est le
            #    changement de composition qui ne crée aucun saut, pas la séance.
            #    À l'inception il n'y a pas d'anciens paramètres → base 100.
            target_value = (
                INDEX_BASE_VALUE if weights is None or divisor is None
                else index_value(weights, closes_for(weights, day), divisor)
            )

            # 2. Nouvelle composition — jamais rejouée si elle est déjà figée en base.
            frozen = existing_weights.get(day)
            if frozen is not None:
                weights = frozen
            else:
                universe, rejected = eligible_universe(candidates, prices, shares, day)
                if not universe:
                    raise RuntimeError(f"Univers éligible vide au {day} — indice impossible.")
                closes_new = {t: carried[t][day] for t in universe}
                missing = [t for t, c in closes_new.items() if c is None]
                if missing:
                    raise RuntimeError(f"Cours manquant au rebalancement du {day} : {missing}")
                weights = build_rebalance(day, universe, closes_new, shares)  # type: ignore[arg-type]
                new_weights.extend(weights)
                for ticker, reason in sorted(rejected.items()):
                    logger.info("  %s exclu du rebalancement du %s — %s", ticker, day, reason)

            # 3. Diviseur de continuité.
            divisor = divisor_for(weights, closes_for(weights, day), target_value)
            summary_rebalances.append({
                "date":         day,
                "constituents": len(weights),
                "divisor":      divisor,
                "capped":       [w["ticker"] for w in weights
                                 if float(w["cap_factor"]) < 1.0 - 1e-9],
                "tickers":      [w["ticker"] for w in weights],
                "new":          frozen is None,
            })

        if weights is None or divisor is None:
            continue  # avant la première séance de l'indice — impossible en pratique

        value = round(index_value(weights, closes_for(weights, day), divisor), _VALUE_DP)
        last_value = value
        row = {"date": str(day), "value": value, "divisor": divisor}
        series.append(row)
        if day not in existing_daily:
            new_daily.append(row)

    if not dry_run:
        if new_weights:
            logger.info("Écriture de %d lignes dans index_weights…", len(new_weights))
            _upsert_batched(db, "index_weights", new_weights)
        if new_daily:
            logger.info("Écriture de %d valeurs dans index_daily…", len(new_daily))
            _upsert_batched(db, "index_daily", new_daily)

    return {
        "sessions":   len(calendar_all),
        "series":     series,
        "written":    len(new_daily),
        "skipped":    len(series) - len(new_daily),
        "rebalances": summary_rebalances,
        "last_value": last_value,
    }
