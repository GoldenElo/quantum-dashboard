"""
Récupère le chiffre d'affaires TTM via yfinance pour les 12 tickers sectoriels
non-ETF, affiche un log de recoupement, et upserte dans revenue_ttm.

Deux mesures conservées par ticker (garde-fou anti-erreur, jamais une seule source) :
  - revenue_reported : totalRevenue TTM rapporté (info) ;
  - revenue_sum_4q   : somme des 4 derniers trimestres publiés (financials).
Le recoupement lui-même (écart, P/S) est présenté par check_ps.py — script de
contrôle en lecture seule. Ici on PERSISTE les deux valeurs + quarters_used pour
que l'API frontend calcule le P/S à la volée (jamais stocké).

Prérequis : la migration 007 (table revenue_ttm) doit être appliquée dans le
dashboard Supabase AVANT d'exécuter ce script. Sans elle, l'upsert échoue avec
un message explicite (aucune écriture partielle).

Usage :
    cd scripts && python3 fetch_revenue.py

Ou via GitHub Actions → workflow_dispatch (mises à jour trimestrielles, comme
fetch_shares.py — pas de cron automatique).

Surcharge manuelle possible sans refonte (source primaire prime via as_of_date) :
    INSERT INTO revenue_ttm (ticker, as_of_date, revenue_reported, revenue_sum_4q,
                             quarters_used, financial_currency, fx_rate, source)
    VALUES ('IONQ', '2026-03-31', 43200000, 43200000, 4, 'USD', 1.0, 'SEC 10-Q 2026-03-31')
    ON CONFLICT (ticker, as_of_date)
    DO UPDATE SET revenue_reported   = EXCLUDED.revenue_reported,
                  revenue_sum_4q     = EXCLUDED.revenue_sum_4q,
                  quarters_used      = EXCLUDED.quarters_used,
                  financial_currency = EXCLUDED.financial_currency,
                  fx_rate            = EXCLUDED.fx_rate,
                  source             = EXCLUDED.source;
"""

from __future__ import annotations

import os
import sys

from dotenv import load_dotenv
from supabase import create_client

from market_data import fetch_revenue_ttm, fetch_fx_to_usd
from guards import is_manual_source, emit_warning

load_dotenv(dotenv_path="../.env.local")
load_dotenv()

_RECOUP_ALERT = 0.05   # écart CA rapporté vs Σ4T > 5 % → alerte CI (recoupement douteux)
_CONTRADICT_ALERT = 0.15  # yfinance vs surcharge manuelle > 15 % → alerte CI

# 13 sociétés sectorielles — QNTM.L, QQQ (ETF) et NVDA (infrastructure) exclus.
TICKERS = ["GOOGL", "IBM", "IONQ", "QBTS", "LAES", "INFQ", "RGTI", "QUBT", "QNT",
           "XNDU", "ARQQ", "HQ", "IQMX"]

# ─── Surcharges manuelles de CA (priment sur yfinance, sanctuarisées) ─────────
# Même rôle que _MANUAL_OVERRIDES dans fetch_shares.py : une source primaire datée
# remplace une donnée yfinance absente ou fausse. `source` commençant par 'SEC' ou
# 'annual-report' → is_manual_source() → jamais écrasée par yfinance.
#
# fx_rate n'est PAS figé ici : il est recalculé au taux de clôture courant à chaque
# exécution (la machinerie fetch_fx_to_usd fait foi), pour que le P/S reste juste.
#
# IQMX : yfinance ne déclare AUCUNE devise de reporting (financialCurrency = None)
#        alors que les états financiers sont en EUR — sans cette surcharge, le
#        garde-fou devise ci-dessous refuse la ligne (et c'est le comportement voulu).
#        CA de l'EXERCICE CLOS au 31/12/2025 : 31,333 M€. Ce n'est pas un TTM et
#        aucun détail trimestriel n'est publié via yfinance → quarters_used = 0 →
#        statut 'unrecouped' côté API → marqueur ‡, jamais un ratio ferme.
_MANUAL_OVERRIDES: list[dict] = [
    {
        "ticker":             "IQMX",
        "as_of_date":         "2025-12-31",
        "revenue_reported":   31_333_000,   # EUR — converti en USD via fx_rate
        "revenue_sum_4q":     None,         # aucun détail trimestriel → recoupement impossible
        "quarters_used":      0,
        "financial_currency": "EUR",
        "source":             "SEC 6-K 2026-07-01 (exercice clos 31/12/2025, reporting EUR)",
    },
]


def _fmt_rev(v: float | None) -> str:
    if v is None:
        return "—"
    if abs(v) >= 1e9:
        return f"{v / 1e9:.2f} G$"
    return f"{v / 1e6:.0f} M$"


def main() -> None:
    db = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_KEY"])

    print(f"\nRécupération du CA TTM + devise via yfinance ({len(TICKERS)} tickers)…")
    rows: list[dict] = []
    errors: list[str] = []
    fx_cache: dict[str, dict] = {}

    def _fx(ccy: str) -> dict:
        if ccy not in fx_cache:
            fx_cache[ccy] = fetch_fx_to_usd(ccy)
        return fx_cache[ccy]

    overridden = {o["ticker"] for o in _MANUAL_OVERRIDES}
    currency_refused: list[str] = []

    for ticker in TICKERS:
        try:
            rev = fetch_revenue_ttm(ticker)

            # ── RÈGLE DEVISE (durcie) : aucune devise devinée ──────────────────
            # Un CA sans devise déclarée est INEXPLOITABLE : le convertir à 1.0 par
            # défaut revient à affirmer « c'est de l'USD » sans preuve. Constaté sur
            # IQMX (états financiers en EUR, financialCurrency = None) → P/S faux de
            # +14 %. On refuse la ligne au lieu de produire un chiffre faux ;
            # une surcharge manuelle sourcée prend le relais.
            raw_ccy = rev.get("financial_currency")
            if not raw_ccy:
                currency_refused.append(ticker)
                covered = "surcharge manuelle présente" if ticker in overridden else \
                          "AUCUNE surcharge — le P/S sera absent"
                emit_warning(
                    f"CA {ticker} — devise de reporting non déclarée",
                    f"yfinance ne renvoie pas financialCurrency : ligne REFUSÉE (aucun défaut USD). "
                    f"{covered}. Vérifier la devise dans le dépôt SEC et surcharger "
                    f"_MANUAL_OVERRIDES dans fetch_revenue.py avec financial_currency explicite.",
                )
                continue

            ccy = raw_ccy.upper()
            fx = _fx(ccy)  # devise native → USD (1.0 si USD), au dernier taux de clôture
            rows.append({
                "ticker":             ticker,
                "as_of_date":         rev["as_of_date"].isoformat(),
                "revenue_reported":   rev["reported"],
                "revenue_sum_4q":     rev["sum_4q"],
                "quarters_used":      rev["quarters_used"],
                "financial_currency": ccy,
                "fx_rate":            fx["rate"],
                "source":             rev["source"],
            })
            print(
                f"  ✓ {ticker:<6} {ccy}  rapporté={_fmt_rev(rev['reported']):>10}  "
                f"Σ4T={_fmt_rev(rev['sum_4q']):>10}  fx={fx['rate']:.4f}  "
                f"({rev['quarters_used']} trim., {rev['as_of_date']})"
            )
        except Exception as exc:  # noqa: BLE001
            errors.append(ticker)
            print(f"  ✗ {ticker} — {exc}", file=sys.stderr)

    # ── Garde-fous : règle d'or + alertes CI ──────────────────────────────────
    # Lecture des lignes existantes (peut échouer si la table n'existe pas encore →
    # on continue sans garde-fou de non-écrasement, l'upsert plus bas tranchera).
    existing: list[dict] = []
    try:
        existing = (
            db.table("revenue_ttm")
            .select("ticker, as_of_date, revenue_reported, source")
            .in_("ticker", TICKERS)
            .order("as_of_date", desc=True)
            .execute()
        ).data or []
    except Exception:  # noqa: BLE001
        existing = []

    manual_pks = {(r["ticker"], r["as_of_date"]) for r in existing if is_manual_source(r["source"])}
    latest_manual: dict[str, dict] = {}
    for r in existing:
        if is_manual_source(r["source"]):
            latest_manual.setdefault(r["ticker"], r)

    # RÈGLE D'OR : yfinance ne remplace jamais une surcharge manuelle (même PK).
    safe_rows: list[dict] = []
    for r in rows:
        if (r["ticker"], r["as_of_date"]) in manual_pks:
            print(f"  ⛔ {r['ticker']} @ {r['as_of_date']} — surcharge manuelle sanctuarisée, valeur yfinance ignorée.")
        else:
            safe_rows.append(r)

    # Alertes CI — recoupement TTM douteux + contradiction vs surcharge SEC.
    for r in rows:
        t = r["ticker"]
        rep, s4 = r["revenue_reported"], r["revenue_sum_4q"]
        if rep and s4 and rep != 0 and abs(s4 - rep) / abs(rep) > _RECOUP_ALERT:
            emit_warning(
                f"CA {t} — recoupement douteux",
                f"rapporté {rep/1e6:.0f} M$ vs Σ4T {s4/1e6:.0f} M$ "
                f"(écart {(s4-rep)/abs(rep)*100:+.1f} % > 5 %) — confronter aux états financiers SEC.",
            )
        mo = latest_manual.get(t)
        if mo and rep and mo.get("revenue_reported"):
            mv = float(mo["revenue_reported"])
            if mv != 0 and abs(rep - mv) / abs(mv) > _CONTRADICT_ALERT:
                emit_warning(
                    f"CA {t} — contredit surcharge",
                    f"yfinance {rep/1e6:.0f} M$ vs surcharge {mv/1e6:.0f} M$ ({mo['source']}) — "
                    f"écart {(rep-mv)/abs(mv)*100:+.1f} %. Re-vérifier le dépôt SEC et ajuster si besoin.",
                )

    # Upsert atomique : on n'écrit rien si aucune ligne n'a pu être constituée.
    if safe_rows:
        try:
            db.table("revenue_ttm").upsert(safe_rows).execute()
            print(f"\n✓ {len(safe_rows)} ligne(s) upsertée(s) dans revenue_ttm.")
        except Exception as exc:  # noqa: BLE001
            print(
                f"\n✗ Échec de l'upsert dans revenue_ttm : {exc}\n"
                "  La table existe-t-elle ? Appliquer d'abord la migration "
                "supabase/migrations/007_revenue_ttm.sql dans le dashboard Supabase.",
                file=sys.stderr,
            )
            sys.exit(1)

    # Surcharges manuelles : upsertées APRÈS les lignes yfinance (elles priment).
    # fx recalculé au taux courant — la devise, elle, est explicite et figée.
    if _MANUAL_OVERRIDES:
        override_rows = []
        for o in _MANUAL_OVERRIDES:
            fx = _fx(o["financial_currency"].upper())
            row = {**o, "fx_rate": fx["rate"]}
            override_rows.append(row)
            rev_usd = (o["revenue_reported"] or 0) * fx["rate"]
            print(
                f"  ⚑ {o['ticker']:<6} surcharge {o['financial_currency']} "
                f"{_fmt_rev(o['revenue_reported'])} × fx {fx['rate']:.4f} "
                f"= {_fmt_rev(rev_usd)} ({o['quarters_used']} trim. → non recoupé) — {o['source']}"
            )
        try:
            db.table("revenue_ttm").upsert(override_rows).execute()
            print(f"✓ {len(override_rows)} surcharge(s) manuelle(s) upsertée(s) dans revenue_ttm.")
        except Exception as exc:  # noqa: BLE001
            print(f"\n✗ Échec de l'upsert des surcharges : {exc}", file=sys.stderr)
            sys.exit(1)

    if currency_refused:
        print(
            f"\n⚑ {len(currency_refused)} ticker(s) refusé(s) faute de devise déclarée : "
            f"{', '.join(currency_refused)}\n"
            "  Comportement VOULU (règle devise durcie) — aucun défaut USD n'est appliqué.\n"
            "  Couvrir chacun par une surcharge sourcée dans _MANUAL_OVERRIDES.",
            file=sys.stderr,
        )

    if errors:
        print(
            f"\n✗ {len(errors)} ticker(s) sans CA récupérable : {', '.join(errors)}\n"
            "  CA absent (pure-player pré-revenus) ou échec réseau — relancer si besoin.",
            file=sys.stderr,
        )

    print("\nRecoupement détaillé et P/S : cd scripts && python3 check_ps.py")


if __name__ == "__main__":
    main()
