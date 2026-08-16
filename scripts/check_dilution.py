"""
Tableau de contrôle de la dilution (C7) — LECTURE SEULE.
N'écrit RIEN en base. Relit `shares_outstanding` / `share_adjustment` et
recalcule tout depuis la source, comme check_changes.py et check_ps.py.

Usage :  cd scripts && python3 check_dilution.py [--liquidites] [TICKER ...]

  --liquidites   tableau des LIQUIDITÉS SEULES, avec le contrôle croisé aux
                 communiqués. N'ouvre aucune connexion Supabase (tout vient
                 d'EDGAR) et sort en code 1 si un recoupement échoue.

Trois blocs par société :
  1. la série historique telle qu'elle est EN BASE, avec la source de chaque
     point et le marqueur d'ajustement ;
  2. les chiffres calculés à la volée (jamais stockés) : dilution annualisée,
     dilution sur 12 mois glissants, actions aujourd'hui vs il y a N ans ;
  3. les signaux factuels : liquidités, consommation, runway arithmétique et
     dépôts déclarés — tous datés et sourcés (règle §10 : aucun score).

CONTRÔLES DURS (échec ⇒ emit_error) :
  · IONQ au 31/12/2025 = 362 592 722 actions ;
  · IONQ dernier relevé ≈ 373,2 M actions ;
  · ARQQ : série ajustée strictement croissante — si elle décroît, l'ajustement
    du regroupement 25:1 a sauté et le module ment.
"""

from __future__ import annotations

import os
import sys
from datetime import date

from dotenv import load_dotenv
from supabase import Client, create_client

import edgar
from backfill_shares_history import DILUTION_TICKERS, TICKER_FIRST_LISTING
from guards import emit_error, emit_warning

load_dotenv(dotenv_path="../.env.local")
load_dotenv()

W = 96
_DAYS_PER_YEAR = 365.25

# Fenêtre acceptable pour un « 12 mois glissants » construit sur des points
# annuels : ils tombent rarement à la date anniversaire. On prend le point le
# plus proche d'un an en arrière DANS cette fenêtre et on annualise sur l'écart
# RÉEL — la fenêtre effectivement utilisée est toujours affichée.
_TTM_MIN_DAYS = 180
_TTM_MAX_DAYS = 550

# Au-delà de ce rythme, ce n'est plus de la dilution : c'est un changement de
# BASE DE MESURE ou une transformation d'entité. Cas réel QNT — le relevé
# yfinance (31,4 M, flottant Class A seul) suivi de la surcharge 424B4 (322 M,
# pleinement dilué Up-C) donnait +39 572 938 %/an. Les deux chiffres sont justes
# et ne mesurent pas la même chose ; les enchaîner produit une absurdité.
# Le seuil sépare nettement les vrais cas : LAES a dilué de +548 %/an entre 2023
# et 2024 (réel, conservé), QNT affichait 4 ordres de grandeur au-dessus.
_BASIS_BREAK_RATE = 20.0  # +2 000 %/an

# ═══════════════ DEUX SEUILS DE FRAÎCHEUR, À NE PAS CONFONDRE ════════════════
#
# 150 j (≈ 5 mois) — on PUBLIE, avec ⚠ et la date du dépôt en évidence. C'est
# la doctrine « données anciennes » déjà appliquée au nombre d'actions du
# tableau S1 (cas LAES au 31/12/2025) : même seuil, même marqueur, pour qu'un
# lecteur n'ait pas deux grilles de lecture selon la ligne qu'il regarde.
# Volontairement PLUS STRICT que les « 2 trimestres » demandés — s'aligner sur
# S1 vaut mieux qu'un chiffre rond propre à ce module.
#
# 270 j (9 mois) — on ne publie PLUS de runway du tout. Le relevé reste affiché
# avec sa date, sans projection. Cas ARQQ, arrêté au 31/03/2025 : projeter une
# consommation sur des liquidités vieilles de 17 mois serait une invention.
_STALE_DISPLAY_DAYS = 150
_STALE_FINANCE_DAYS = 270

# Au-delà de 20 trimestres, le runway cesse d'informer. « ~112 trimestres »
# (QUBT) est exact et illisible : personne ne pilote une trésorerie à 28 ans, et
# le chiffre donne une fausse impression de précision sur une projection qui
# suppose la consommation actuelle constante pendant trois décennies. On plafonne
# l'AFFICHAGE — le calcul reste entier dans le tableau de contrôle.
_RUNWAY_CAP_QUARTERS = 20

# Ancres de validation fournies par la rédaction (chiffres vérifiés à la main).
_ANCHORS = {
    "IONQ": {"2025-12-31": 362_592_722, "_latest_approx": 373_200_000},
}

# ═══════════ CONTRÔLE CROISÉ DES LIQUIDITÉS — communiqués de résultats ═══════
#
# Le total extrait d'EDGAR est confronté au chiffre publié par la société dans
# son communiqué (base d'événements C6). Écart > 10 % ⇒ contrôle dur en échec :
# le runway est BLOQUÉ, pas seulement signalé. La règle vient d'un cas concret —
# une extraction incomplète donnait 27,8 M$ et ~2 trimestres de runway à RGTI,
# qui déclare 541,3 M$ et zéro dette. Publier cela aurait été une fausse alerte,
# c'est-à-dire l'erreur la plus coûteuse que ce module puisse commettre.
#
# `approx` = le communiqué lui-même arrondit ; l'écart se juge à la tolérance
# de 10 %, pas à l'unité près.
_LIQUIDITY_TOLERANCE = 0.10

_LIQUIDITY_ANCHORS: dict[str, dict] = {
    "RGTI": {
        "value": 541_300_000,
        "label": "cash, equivalents and available-for-sale investments, zéro dette",
        "source": "communiqué Q2 2026 (10-Q du 06/08/2026)",
    },
    "QBTS": {
        "value": 546_200_000,
        "label": "trésorerie + titres négociables courants",
        "source": "communiqué Q2 2026 (10-Q du 06/08/2026)",
        # Le communiqué s'arrête aux titres COURANTS ; l'extraction ajoute les
        # 4,2 M$ de placements non courants. Écart attendu ≈ +0,8 %, sous la
        # tolérance — c'est une différence de périmètre connue, pas une erreur.
    },
    "QNT": {
        "value": 2_100_000_000,
        "approx": True,
        "label": "trésorerie et équivalents (aucun placement déclaré)",
        "source": "communiqué Q2 2026 / 8-K du 11/08/2026",
    },
    "QUBT": {
        "value": 1_300_000_000,
        "approx": True,
        "label": "cash, cash equivalents and investments",
        "source": "communiqué Q2 2026 du 10/08/2026 (8-K, ex. 99.1)",
        # ⚠ NE PAS ancrer sur 954 M$. Ce chiffre — porté un temps dans notre
        # saisie C6 — est trésorerie + placements COURANTS seuls
        # (189,150 + 765,020 = 954,170), c'est-à-dire exactement le périmètre
        # partiel que ce module vient de corriger. La société écrit noir sur
        # blanc « Ends quarter with $1.3 billion in cash, cash equivalents and
        # investments ». Recoupement indépendant sur une SECONDE date : le
        # communiqué annonce ≈ 1,5 G$ au 31/12/2025, nos tags donnent
        # 737,880 + 379,421 + 403,121 = 1 520,4 M$. Le périmètre tient deux fois.
    },
    "IONQ": {
        "value": 3_000_000_000,
        "approx": True,
        "label": "trésorerie + placements courants et non courants au 30/06",
        "source": "communiqué Q2 2026 (10-Q du 10/08/2026)",
        # ⚠ NE PAS recouper sur les ~2 Md$ pro forma : l'acquisition SkyWater a
        # été clôturée APRÈS le 30/06, donc hors du bilan du 10-Q. Les deux
        # chiffres sont justes et ne mesurent pas la même date. Le pro forma est
        # affiché comme note, jamais comme ancre.
        "post_closing_note": (
            "≈ 2 Md$ pro forma après clôture de l'acquisition SkyWater, "
            "intervenue APRÈS le 30/06/2026 — hors bilan du 10-Q."
        ),
    },
}


def _supabase_client() -> Client:
    return create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_KEY"])


def _fmt_shares(n: int | None) -> str:
    return "—" if n is None else f"{n:,}".replace(",", " ")


def _fmt_pct(v: float | None) -> str:
    if v is None:
        return "—"
    return f"{v * 100:+.1f} %".replace(".", ",")


def _fmt_musd(v: float | None) -> str:
    if v is None:
        return "—"
    return f"{v / 1e6:,.1f} M$".replace(",", " ").replace(".", ",")


def _step_rate(a: dict, b: dict) -> float | None:
    """Taux annualisé entre deux relevés consécutifs."""
    days = (b["date"] - a["date"]).days
    if days <= 0 or a["shares"] <= 0:
        return None
    return (b["shares"] / a["shares"]) ** (_DAYS_PER_YEAR / days) - 1


def comparable_segment(points: list[dict]) -> tuple[list[dict], list[tuple]]:
    """
    Ne conserve que le dernier segment de relevés COMPARABLES entre eux.

    Deux relevés consécutifs dont l'écart annualisé dépasse `_BASIS_BREAK_RATE`
    ne mesurent pas la même chose (changement de base : flottant vs pleinement
    dilué, entité privée vs cotée…). On coupe la série à cet endroit plutôt que
    de publier un taux absurde, et on RETOURNE la rupture pour la signaler —
    jamais de coupe silencieuse.
    """
    breaks: list[tuple] = []
    cut = 0
    for i in range(1, len(points)):
        rate = _step_rate(points[i - 1], points[i])
        if rate is not None and abs(rate) > _BASIS_BREAK_RATE:
            breaks.append((points[i - 1], points[i], rate))
            cut = i
    return points[cut:], breaks


def annualized_dilution(points: list[dict]) -> tuple[float | None, float | None]:
    """(taux annualisé, nombre d'années couvertes) sur toute la série disponible."""
    if len(points) < 2:
        return None, None
    first, last = points[0], points[-1]
    days = (last["date"] - first["date"]).days
    if days <= 0 or first["shares"] <= 0:
        return None, None
    years = days / _DAYS_PER_YEAR
    return (last["shares"] / first["shares"]) ** (1 / years) - 1, years


def ttm_dilution(points: list[dict]) -> tuple[float | None, dict | None]:
    """
    Rythme récent : dernier relevé vs le plus proche d'un an en arrière, ANNUALISÉ
    sur l'écart réel. Retourne aussi le point de départ retenu, pour que la
    fenêtre effectivement utilisée soit affichée — un « 12 mois » calculé sur
    15 mois doit le dire.
    """
    if len(points) < 2:
        return None, None
    last = points[-1]
    target = last["date"].toordinal() - _DAYS_PER_YEAR
    candidates = [
        p for p in points[:-1]
        if _TTM_MIN_DAYS <= (last["date"] - p["date"]).days <= _TTM_MAX_DAYS and p["shares"] > 0
    ]
    if not candidates:
        return None, None
    best = min(candidates, key=lambda p: abs(p["date"].toordinal() - target))
    rate = _step_rate(best, last)
    return rate, best


# ═════════════════════════ Liquidités et runway ══════════════════════════════

def runway_label(quarters: float | None) -> str:
    """
    Libellé du runway tel qu'il sera AFFICHÉ — plafonné au-delà de 5 ans.

    Miroir exact de `runwayLabel` (src/lib/dilution.ts). Les deux doivent dire
    la même chose : si le tableau de contrôle et la fiche divergeaient, c'est le
    tableau de contrôle qui perdrait son sens.
    """
    if quarters is None:
        return "—"
    if quarters > _RUNWAY_CAP_QUARTERS:
        return "> 5 ans au rythme actuel — projection non contraignante"
    return f"~{round(quarters)} trimestres au rythme actuel"


def liquidity_report(ticker: str) -> dict:
    """
    Ressources liquides TOTALES, recoupées au communiqué, et runway conditionnel.

    Le runway n'est calculé que si TROIS conditions sont réunies. Chacune répond
    à une façon documentée de produire un chiffre faux :
      1. le total est recoupé au communiqué à ±10 % (sinon l'extraction est
         incomplète — cas RGTI à 27,8 M$ contre 541,3 M$ déclarés) ;
      2. le relevé a moins de 9 mois (sinon on projette sur une photo périmée —
         cas ARQQ, arrêté au 31/03/2025) ;
      3. la consommation est négative et mesurée sur une période publiée.
    Une condition qui manque ne dégrade pas le chiffre : elle le supprime.
    """
    rep: dict = {"ticker": ticker, "fin": None, "anchor": None, "gap": None,
                 "cross": "absent", "stale": False, "stale_display": False,
                 "days_old": None, "runway": None, "blocked_reason": None,
                 "error": None}

    cik = edgar.TICKER_CIK.get(ticker)
    if not cik:
        rep["error"] = "aucun CIK connu (société hors périmètre EDGAR)"
        return rep

    try:
        fin = edgar.quarterly_cash_and_burn(cik)
    except Exception as exc:  # noqa: BLE001
        rep["error"] = str(exc)
        emit_warning("EDGAR injoignable", f"{ticker} — {exc}")
        return rep

    if fin.get("cash") is None:
        rep["error"] = "aucune donnée de trésorerie exploitable"
        return rep

    rep["fin"] = fin
    rep["days_old"] = (date.today() - fin["as_of"]).days
    rep["stale"] = rep["days_old"] > _STALE_FINANCE_DAYS
    rep["stale_display"] = rep["days_old"] > _STALE_DISPLAY_DAYS

    anchor = _LIQUIDITY_ANCHORS.get(ticker)
    if anchor:
        rep["anchor"] = anchor
        rep["gap"] = fin["liquidity"] / anchor["value"] - 1
        rep["cross"] = "ko" if abs(rep["gap"]) > _LIQUIDITY_TOLERANCE else "ok"

    if rep["cross"] == "ko":
        rep["blocked_reason"] = (
            f"écart de {_fmt_pct(rep['gap'])} au communiqué "
            f"({_fmt_musd(anchor['value'])}) — extraction à corriger avant publication"
        )
    elif rep["stale"]:
        rep["blocked_reason"] = (
            f"dernières données : {fin['as_of']} ({rep['days_old']} j) — "
            f"aucune projection sur un relevé de plus de 9 mois"
        )
    elif rep["cross"] == "absent":
        rep["blocked_reason"] = "total non recoupé à un communiqué — runway indicatif, à valider"

    burn = fin["burn_per_quarter"]
    if burn and burn < 0 and rep["cross"] != "ko" and not rep["stale"]:
        rep["runway"] = fin["liquidity"] / abs(burn)
    return rep


def print_liquidity(rep: dict, indent: str = "   ") -> None:
    """Affiche un rapport de liquidités — détail des seaux, recoupement, runway."""
    ticker = rep["ticker"]
    if rep["error"]:
        print(f"{indent}Liquidités : {rep['error']} (signalé, non comblé)")
        return

    fin, used = rep["fin"], rep["fin"]["concepts_used"]
    print(f"{indent}Liquidités totales {_fmt_musd(fin['liquidity']):>14}   au {fin['as_of']}"
          f"   [{fin['source_form']} déposé {fin['source_filed']}]")
    print(f"{indent}   trésorerie          {_fmt_musd(fin['cash']):>14}   {used.get('cash', '—')}")
    print(f"{indent}   placements courants {_fmt_musd(fin['invest_current']):>14}   "
          f"{used.get('invest_current', 'aucun tag déclaré')}")
    print(f"{indent}   placements non cour.{_fmt_musd(fin['invest_noncurrent']):>14}   "
          f"{used.get('invest_noncurrent', 'aucun tag déclaré')}")

    # Tags concurrents du même seau qui ne disent PAS la même chose : la règle
    # « premier tag trouvé » n'est valable que tant qu'ils s'accordent.
    for tag, val in fin.get("divergent_tags", []):
        print(f"{indent}   ⚑ tag concurrent divergent : {tag} = {_fmt_musd(val)} "
              f"— convention de balisage à revérifier")

    anchor = rep["anchor"]
    if anchor:
        mark = "✔" if rep["cross"] == "ok" else "✖"
        approx = "≈ " if anchor.get("approx") else ""
        print(f"{indent}   {mark} recoupement  {approx}{_fmt_musd(anchor['value'])} "
              f"— écart {_fmt_pct(rep['gap'])}   ({anchor['source']})")
        print(f"{indent}     périmètre communiqué : {anchor['label']}")
        if anchor.get("post_closing_note"):
            print(f"{indent}     ⓘ {anchor['post_closing_note']}")
    else:
        print(f"{indent}   ⚑ aucun communiqué de référence en base — total NON RECOUPÉ")

    burn = fin["burn_per_quarter"]
    print(f"{indent}   consommation {_fmt_musd(burn):>14} / trimestre — période publiée "
          f"{fin['period_start']} → {fin['period_end']} ({fin['period_days']} j)")

    if rep["runway"] is not None:
        suffix = "   ⚑ non recoupé" if rep["cross"] == "absent" else ""
        exact = f"~{round(rep['runway'])} trimestres"
        print(f"{indent}   runway       {exact:>14}   (ressources totales ÷ consommation){suffix}")
        if rep["runway"] > _RUNWAY_CAP_QUARTERS:
            print(f"{indent}                → affiché en fiche : « {runway_label(rep['runway'])} »")
        if rep["stale_display"]:
            print(f"{indent}                ⚠ affiché en fiche avec la mention « données au "
                  f"{fin['as_of']} » ({rep['days_old']} j)")
    else:
        print(f"{indent}   runway                    NON AFFICHÉ — {rep['blocked_reason']}")


def liquidity_table(tickers: list[str]) -> tuple[list[str], list[str]]:
    """Tableau de contrôle des LIQUIDITÉS SEULES. Retourne (échecs durs, signalements)."""
    alerts: list[str] = []
    notices: list[str] = []

    print("\nTABLEAU DE CONTRÔLE — LIQUIDITÉS ET RUNWAY (C7)")
    print("Ressources liquides TOTALES = trésorerie + placements courants + non courants.")
    print(f"Contrôle croisé aux communiqués de résultats (C6), tolérance "
          f"{_LIQUIDITY_TOLERANCE:.0%} — au-delà, le runway est bloqué.")
    print("═" * W)

    for ticker in tickers:
        print(f"\n{ticker}")
        print("─" * W)
        rep = liquidity_report(ticker)
        print_liquidity(rep)

        if rep["cross"] == "ko":
            msg = (f"{ticker} — liquidités extraites {_fmt_musd(rep['fin']['liquidity'])} vs "
                   f"{_fmt_musd(rep['anchor']['value'])} au communiqué : écart "
                   f"{_fmt_pct(rep['gap'])} > {_LIQUIDITY_TOLERANCE:.0%}. Runway bloqué.")
            emit_error("Recoupement liquidités", msg)
            alerts.append(msg)
        elif rep["stale"] and rep["fin"]:
            msg = (f"{ticker} — dernières données : {rep['fin']['as_of']} "
                   f"({rep['days_old']} j). Runway non affiché, aucune projection.")
            emit_warning("Trésorerie périmée", msg)
            notices.append(msg)
        elif rep["cross"] == "absent" and rep["fin"]:
            msg = (f"{ticker} — total {_fmt_musd(rep['fin']['liquidity'])} non recoupé à un "
                   f"communiqué : à confronter aux états financiers avant publication.")
            notices.append(msg)
        elif rep["error"]:
            notices.append(f"{ticker} — {rep['error']}")

    return alerts, notices


def main() -> None:
    argv = [a for a in sys.argv[1:] if a != "--liquidites"]
    if "--liquidites" in sys.argv:
        tickers = [t.upper() for t in argv] or DILUTION_TICKERS
        alerts, notices = liquidity_table(tickers)
        print("\n" + "═" * W)
        if notices:
            print("\n⚑ SIGNALEMENTS — signalés, NON masqués ; l'humain tranche :")
            for n in notices:
                print(f"   · {n}")
        if alerts:
            print("\n⚑ CONTRÔLES DURS EN ÉCHEC — publication bloquée :", file=sys.stderr)
            for a in alerts:
                print(f"   · {a}", file=sys.stderr)
            sys.exit(1)
        print("\nTous les contrôles croisés passent.\n")
        return

    tickers = [t.upper() for t in argv] or DILUTION_TICKERS
    db = _supabase_client()

    shares_res = (
        db.table("shares_outstanding")
        .select("ticker, as_of_date, shares, source")
        .in_("ticker", tickers)
        .order("as_of_date", desc=False)
        .execute()
    )
    history: dict[str, list[dict]] = {}
    for r in shares_res.data or []:
        history.setdefault(r["ticker"], []).append({
            "date": date.fromisoformat(r["as_of_date"]),
            "shares": int(r["shares"]),
            "source": r["source"],
        })

    try:
        adj_res = db.table("share_adjustment").select("*").in_("ticker", tickers).execute()
        adjustments: dict[str, list[dict]] = {}
        for r in adj_res.data or []:
            adjustments.setdefault(r["ticker"], []).append(r)
    except Exception:  # noqa: BLE001
        adjustments = {}
        emit_warning("share_adjustment absente", "migration 012 non appliquée — journal d'audit ignoré.")

    alerts: list[str] = []    # contrôles durs en échec
    notices: list[str] = []   # signalements — l'humain tranche

    print("\nTABLEAU DE CONTRÔLE — DILUTION (C7)")
    print("═" * W)

    for ticker in tickers:
        pts = history.get(ticker, [])
        listing = TICKER_FIRST_LISTING.get(ticker)
        print(f"\n{ticker}" + (f"   (cotation {listing})" if listing else ""))
        print("─" * W)

        if not pts:
            print("   aucun relevé en base")
            continue

        adj_by_date = {a["effective_date"]: a for a in adjustments.get(ticker, [])}
        for p in pts:
            a = adj_by_date.get(p["date"].isoformat())
            mark = f"  ⇦ ajusté (ratio {float(a['ratio']):g}:1)" if a else ""
            print(f"   {p['date']}  {_fmt_shares(p['shares']):>17}   {p['source'][:44]:44}{mark}")

        series, breaks = comparable_segment(pts)
        print()
        for a, b, r in breaks:
            msg = (f"{ticker} — rupture de base de mesure entre {a['date']} "
                   f"({_fmt_shares(a['shares'])}, {a['source'][:28]}) et {b['date']} "
                   f"({_fmt_shares(b['shares'])}, {b['source'][:28]}) : "
                   f"{_fmt_pct(r)}/an. Série coupée, calcul repris après la rupture.")
            print(f"   ⚑ {msg}")
            emit_warning("Rupture de base de mesure", msg)
            notices.append(msg)

        rate, years = annualized_dilution(series)
        ttm, ttm_from = ttm_dilution(series)

        if rate is None:
            print("   Dilution : un seul relevé comparable — non calculable (« depuis cotation »)")
        else:
            total = series[-1]["shares"] / series[0]["shares"] - 1
            print(f"   Dilution annualisée   {_fmt_pct(rate):>10}   sur {years:.1f} an(s) "
                  f"({series[0]['date']} → {series[-1]['date']})")
            if ttm_from is not None:
                window = (series[-1]["date"] - ttm_from["date"]).days
                print(f"   Rythme récent         {_fmt_pct(ttm):>10}   annualisé sur "
                      f"{window} j ({ttm_from['date']} → {series[-1]['date']})")
            else:
                print(f"   Rythme récent         {'—':>10}   aucun relevé à ~1 an en arrière")
            print(f"   Actions × {series[-1]['shares'] / series[0]['shares']:.2f} "
                  f"sur la période ({_fmt_pct(total)})")

        # ── Signaux factuels ──
        cik = edgar.TICKER_CIK.get(ticker)
        if cik:
            print()
            rep = liquidity_report(ticker)
            print_liquidity(rep)
            if rep["cross"] == "ko":
                msg = (f"{ticker} — liquidités extraites {_fmt_musd(rep['fin']['liquidity'])} vs "
                       f"{_fmt_musd(rep['anchor']['value'])} au communiqué : écart "
                       f"{_fmt_pct(rep['gap'])} > {_LIQUIDITY_TOLERANCE:.0%}. Runway bloqué.")
                emit_error("Recoupement liquidités", msg)
                alerts.append(msg)
            elif rep["stale"] and rep["fin"]:
                msg = (f"{ticker} — dernières données : {rep['fin']['as_of']} "
                       f"({rep['days_old']} j). Runway non affiché, aucune projection.")
                emit_warning("Trésorerie périmée", msg)
                notices.append(msg)

            try:
                filings = edgar.recent_filings(cik, edgar.SHELF_FORMS, limit=3)
                if filings:
                    print("   Dépôts déclarés :", "  ·  ".join(
                        f"{f['form']} du {f['filed']}" for f in filings))
                else:
                    print("   Dépôts déclarés : aucun")
            except Exception:  # noqa: BLE001
                pass

        # ── Contrôles durs ──
        anchor = _ANCHORS.get(ticker)
        if anchor:
            by_date = {p["date"].isoformat(): p["shares"] for p in pts}
            for iso, expected in anchor.items():
                if iso.startswith("_"):
                    continue
                got = by_date.get(iso)
                if got != expected:
                    msg = (f"{ticker} {iso} : attendu {expected:,}, trouvé "
                           f"{got:,}" if got else f"{ticker} {iso} : point absent")
                    emit_error("Ancre de validation", msg)
                    alerts.append(msg)
            approx = anchor.get("_latest_approx")
            if approx and abs(pts[-1]["shares"] - approx) / approx > 0.005:
                msg = (f"{ticker} dernier relevé {pts[-1]['shares']:,} — attendu ≈ {approx:,}")
                emit_error("Ancre de validation", msg)
                alerts.append(msg)

        if ticker == "ARQQ" and len(pts) >= 2:
            decreasing = [
                (pts[i - 1], pts[i]) for i in range(1, len(pts))
                if pts[i]["shares"] < pts[i - 1]["shares"]
            ]
            if decreasing:
                a, b = decreasing[0]
                msg = (f"ARQQ série DÉCROISSANTE {a['date']} ({a['shares']:,}) → "
                       f"{b['date']} ({b['shares']:,}) — l'ajustement du regroupement "
                       f"25:1 a sauté, le module mentirait.")
                emit_error("Ajustement des splits", msg)
                alerts.append(msg)
            else:
                print("\n   ✔ contrôle ajustement : série strictement croissante")

    print("\n" + "═" * W)
    if notices:
        print("\n⚑ SIGNALEMENTS — signalés, NON masqués ; l'humain tranche :")
        for n in notices:
            print(f"   · {n}")
    if alerts:
        print("\n⚑ CONTRÔLES DURS EN ÉCHEC — à trancher avant affichage :", file=sys.stderr)
        for a in alerts:
            print(f"   · {a}", file=sys.stderr)
    else:
        print("Tous les contrôles durs passent.\n")


if __name__ == "__main__":
    main()
