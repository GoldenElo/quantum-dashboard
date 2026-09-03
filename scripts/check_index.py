"""
Tableau de contrôle de l'Indice TQW (C3) — LECTURE SEULE.
N'écrit RIEN en base. Sert à valider l'indice avant tout affichage frontend.

Rejoue la chaîne complète en mémoire (compute_index dry_run) et la confronte aux
valeurs publiées : toute dérive est SIGNALÉE, jamais écrasée. Une dérive non nulle
signifie qu'une donnée sous-jacente a bougé rétroactivement — split réécrivant
adj_close, ou surcharge shares_outstanding rétro-datée. L'humain tranche.

Contrôles durs :
  - valeur à l'inception = 100,000000 exactement ;
  - Σ des poids courants = 100 % ;
  - aucun poids > 25 % AU REBALANCEMENT (entre deux rebalancements, la dérive
    au-delà du plafond est normale et attendue) ;
  - recalcul de la chaîne ≡ valeurs publiées.

Usage : cd scripts && python3 check_index.py
"""

from __future__ import annotations

import os
import sys
from datetime import date, timedelta

from dotenv import load_dotenv
from supabase import create_client, Client

from index_tqw import (
    INDEX_BASE_VALUE,
    MIN_SESSIONS,
    REBALANCE_MONTHS,
    WEIGHT_CAP,
    compute_index,
    load_index_daily,
    load_index_weights,
    load_prices,
    load_universe,
    sessions_before,
)
from market_data import last_close_date

load_dotenv(dotenv_path="../.env.local")
load_dotenv()

# Tolérance de comparaison entre la chaîne recalculée et la série publiée.
# Au-delà, une donnée sous-jacente a bougé rétroactivement.
_DRIFT_TOLERANCE = 1e-6

# (libellé, offset en séances) — mêmes horizons que check_changes.py / api.ts
HORIZONS = [("Jour", 1), ("Semaine", 5), ("Mois", 21)]


def _supabase_client() -> Client:
    return create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_KEY"])


def _names(db: Client) -> dict[str, str]:
    res = db.table("asset").select("ticker, name").execute()
    return {r["ticker"]: r["name"] for r in (res.data or [])}


def _latest_closes(db: Client, tickers: list[str]) -> dict[str, tuple[str, float]]:
    """{ticker: (date, adj_close)} — dernière cotation connue, une requête par ticker."""
    out: dict[str, tuple[str, float]] = {}
    for ticker in tickers:
        res = (
            db.table("price_daily")
            .select("date, adj_close")
            .eq("ticker", ticker)
            .order("date", desc=True)
            .limit(1)
            .execute()
        )
        if res.data:
            out[ticker] = (res.data[0]["date"], float(res.data[0]["adj_close"]))
    return out


def _change(values: list[float], offset: int) -> float | None:
    if len(values) <= offset:
        return None
    past = values[-1 - offset]
    if past == 0:
        return None
    return values[-1] / past - 1.0


def _pct(value: float | None, decimals: int = 2) -> str:
    if value is None:
        return "—"
    return f"{value * 100:+.{decimals}f} %".replace(".", ",")


def _num(value: float, decimals: int = 6) -> str:
    return f"{value:.{decimals}f}".replace(".", ",")


def _next_rebalance(after: date) -> date:
    """1er du prochain mois de rebalancement strictement après `after`."""
    year, month = after.year, after.month
    for _ in range(24):
        month += 1
        if month > 12:
            month, year = 1, year + 1
        if month in REBALANCE_MONTHS:
            return date(year, month, 1)
    raise RuntimeError("Calendrier de rebalancement introuvable.")


def _remaining_weekdays(start: date, end: date) -> int:
    """
    Jours ouvrés entre `start` (exclu) et `end` (exclu) — MAJORANT du nombre de
    séances encore à venir avant le rebalancement (les fériés US ne sont pas
    déduits). Sert uniquement à distinguer « peut encore devenir éligible » de
    « ne le sera pas » : un majorant est le bon sens de l'erreur, il ne promet
    jamais une éligibilité, il refuse seulement de l'exclure à tort.
    """
    n = 0
    d = start + timedelta(days=1)
    while d < end:
        if d.weekday() < 5:
            n += 1
        d += timedelta(days=1)
    return n


def main() -> None:
    db = _supabase_client()
    alerts: list[str] = []

    try:
        published = load_index_daily(db)
        rebalances = load_index_weights(db)
    except Exception as exc:  # noqa: BLE001 — migration 010 non appliquée
        print(f"✗  Tables de l'indice illisibles (migration 010 appliquée ?) : {exc}",
              file=sys.stderr)
        sys.exit(1)

    if not published or not rebalances:
        print("Aucune donnée d'indice en base. Lancer d'abord : python3 backfill_index.py",
              file=sys.stderr)
        sys.exit(1)

    dates = sorted(published)
    inception, latest = dates[0], dates[-1]
    values = [published[d]["value"] for d in dates]

    header = (f"  {'Ticker':<7} {'Société':<24} {'Capitalisation':>15} "
              f"{'Poids rebal.':>13} {'Poids courant':>14} {'Dérive':>9}")
    width = len(header)

    print()
    print("═" * width)
    print("  INDICE TQW — TABLEAU DE CONTRÔLE".ljust(width - 20) + "(lecture seule)")
    print("═" * width)
    print(f"  Base {INDEX_BASE_VALUE:.0f} au {inception} · dernière séance {latest} "
          f"· {len(dates)} séances")
    print()
    print(f"  Valeur au {inception} : {_num(values[0]):>14}")
    print(f"  Valeur au {latest} : {_num(values[-1]):>14}   "
          f"({_pct(values[-1] / values[0] - 1, 1)} depuis l'inception)")
    print("  " + "   ".join(f"{lbl} {_pct(_change(values, off))}" for lbl, off in HORIZONS))

    # ── Rebalancements ────────────────────────────────────────────────────────
    print()
    print("  REBALANCEMENTS")
    for reb_date in sorted(rebalances):
        rows = rebalances[reb_date]
        capped = [r["ticker"] for r in rows if float(r["cap_factor"]) < 1.0 - 1e-9]
        divisor = published.get(reb_date, {}).get("divisor")
        label = "inception" if reb_date == inception else "trimestriel"
        divisor_txt = f"  diviseur {divisor:.6g}" if divisor is not None else ""
        print(f"    {reb_date}  {label:<12} {len(rows):>2} constituants{divisor_txt}")
        print(f"      écrêtées à {WEIGHT_CAP * 100:.0f} % : {', '.join(capped) or 'aucune'}")
        print(f"      {', '.join(r['ticker'] for r in rows)}")

    # ── Constituants et poids courants ────────────────────────────────────────
    last_reb = max(rebalances)
    composition = rebalances[last_reb]
    names = _names(db)
    closes = _latest_closes(db, [r["ticker"] for r in composition])

    adjusted: dict[str, float] = {}
    caps_now: dict[str, float] = {}
    for row in composition:
        ticker = row["ticker"]
        if ticker not in closes:
            alerts.append(f"{ticker} : aucune cotation — poids courant incalculable.")
            continue
        price = closes[ticker][1]
        caps_now[ticker] = float(row["shares"]) * price
        adjusted[ticker] = caps_now[ticker] * float(row["cap_factor"])
    total_adjusted = sum(adjusted.values())

    print()
    print(f"  CONSTITUANTS AU {latest} — composition figée au rebalancement du {last_reb}")
    print("─" * width)
    print(header)
    print("─" * width)
    for row in composition:
        ticker = row["ticker"]
        if ticker not in adjusted:
            print(f"  {ticker:<7} {names.get(ticker, '?'):<24} {'ABSENT':>15}")
            continue
        w_reb = float(row["weight_capped"])
        w_now = adjusted[ticker] / total_adjusted
        drift = w_now - w_reb
        flag = " ⚑" if w_now > WEIGHT_CAP + 1e-9 else ""
        print(f"  {ticker:<7} {names.get(ticker, '?'):<24} "
              f"{caps_now[ticker] / 1e9:>12,.2f} Md$ "
              f"{w_reb * 100:>12.2f} % {w_now * 100:>12.2f} %{flag:<2} "
              f"{drift * 100:>+7.2f} pt")
    print("─" * width)
    total_now = sum(adjusted[t] / total_adjusted for t in adjusted) * 100
    print(f"  {'TOTAL':<7} {'':<24} {sum(caps_now.values()) / 1e9:>12,.2f} Md$ "
          f"{sum(float(r['weight_capped']) for r in composition) * 100:>12.2f} % "
          f"{total_now:>12.2f} %")

    # ── Candidats hors univers ────────────────────────────────────────────────
    candidates = load_universe(db)
    members = {r["ticker"] for r in composition}
    outsiders = [t for t in candidates if t not in members]
    if outsiders:
        prices = load_prices(db, outsiders)
        next_reb = _next_rebalance(latest)
        print()
        print(f"  HORS UNIVERS — prochain rebalancement le 1er {next_reb.strftime('%m/%Y')} "
              f"(1re séance suivante)")
        # ⚠ `sessions_before` compte les séances DÉJÀ EN BASE, pas celles que la
        # société aura cotées au rebalancement. Pour une cotation récente, le
        # compte continue de monter d'ici là : annoncer « non éligible » sur ce
        # chiffre ferait lire comme acquis un verdict que seule la date du
        # rebalancement peut rendre. On distingue donc trois états — et on nomme
        # la date à laquelle le décompte est arrêté (cas PSQL, 03/09/2026 :
        # 4 séances en base, ~30 franchies à la mi-octobre, rebalancement 02/11).
        for ticker in outsiders:
            n = sessions_before(prices.get(ticker) or {}, next_reb)
            missing = MIN_SESSIONS - n
            if n >= MIN_SESSIONS:
                verdict = "éligible"
            elif missing <= _remaining_weekdays(latest, next_reb):
                verdict = (f"{missing} séance(s) manquante(s) — atteignable d'ici "
                           f"le rebalancement, à revérifier alors")
            else:
                verdict = f"non éligible — {missing} séance(s) manquante(s)"
            print(f"    {ticker:<7} {names.get(ticker, '?'):<24} "
                  f"{n:>4} séances en base au {latest} → {verdict}")

    # ── Contrôles ─────────────────────────────────────────────────────────────
    print()
    print("  CONTRÔLES")

    gap_base = abs(values[0] - INDEX_BASE_VALUE)
    ok = gap_base < 1e-6
    print(f"    [{'OK' if ok else '!!'}] valeur à l'inception = {_num(values[0])} "
          f"(écart {gap_base:.1e})")
    if not ok:
        alerts.append(f"Valeur d'inception {values[0]} ≠ {INDEX_BASE_VALUE}.")

    gap_sum = abs(total_now - 100.0)
    ok = gap_sum < 1e-6
    print(f"    [{'OK' if ok else '!!'}] Σ poids courants = {_num(total_now)} % "
          f"(écart {gap_sum:.1e})")
    if not ok:
        alerts.append(f"Σ des poids courants = {total_now} % ≠ 100 %.")

    over = [(d, r["ticker"], float(r["weight_capped"]))
            for d, rows in rebalances.items() for r in rows
            if float(r["weight_capped"]) > WEIGHT_CAP + 1e-9]
    ok = not over
    print(f"    [{'OK' if ok else '!!'}] aucun poids > {WEIGHT_CAP * 100:.0f} % "
          f"au rebalancement")
    for d, ticker, w in over:
        alerts.append(f"Plafond violé au rebalancement du {d} : {ticker} à {w * 100:.2f} %.")

    try:
        replay = compute_index(db, latest, dry_run=True)
        drift = 0.0
        drift_date = None
        for row in replay["series"]:
            day = date.fromisoformat(row["date"])
            if day in published:
                gap = abs(row["value"] - published[day]["value"])
                if gap > drift:
                    drift, drift_date = gap, day
        ok = drift <= _DRIFT_TOLERANCE
        print(f"    [{'OK' if ok else '⚑ '}] recalcul de la chaîne ≡ série publiée "
              f"(dérive max {drift:.1e})")
        if not ok:
            alerts.append(
                f"Dérive de {drift:.2e} au {drift_date} entre le recalcul et la série "
                f"publiée — une donnée sous-jacente a bougé rétroactivement (split ? "
                f"surcharge shares_outstanding rétro-datée ?). Série publiée CONSERVÉE."
            )
        missing = [r["date"] for r in replay["series"]
                   if date.fromisoformat(r["date"]) not in published]
        if missing:
            alerts.append(f"{len(missing)} séance(s) sans valeur publiée "
                          f"(première : {missing[0]}) — relancer backfill_index.py.")
    except Exception as exc:  # noqa: BLE001
        print(f"    [!!] recalcul impossible : {exc}")
        alerts.append(f"Recalcul de contrôle impossible : {exc}")

    drifted = [t for t in adjusted if adjusted[t] / total_adjusted > WEIGHT_CAP + 1e-9]
    if drifted:
        print(f"    [⚑ ] dérive au-delà du plafond : {', '.join(drifted)} — "
              f"NORMAL entre deux rebalancements")

    print("═" * width)
    print()

    if alerts:
        print("⚑ ALERTES — signalées, NON masquées ; l'humain tranche :", file=sys.stderr)
        for alert in alerts:
            print(f"   • {alert}", file=sys.stderr)
        print(file=sys.stderr)

    last_close = last_close_date()
    if str(last_close) != str(latest):
        print(f"Note : dernière clôture de marché {last_close}, dernière valeur d'indice "
              f"{latest} — lancer ingest.py ou backfill_index.py pour rattraper.")


if __name__ == "__main__":
    main()
