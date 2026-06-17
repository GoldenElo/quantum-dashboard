"""
Récupère le nombre d'actions en circulation via yfinance pour tous les actifs
non-ETF du dashboard, affiche un tableau de contrôle, et upserte dans
shares_outstanding.

Usage :
    cd scripts && python fetch_shares.py

Ou via GitHub Actions → workflow_dispatch "Fetch shares outstanding".

Surcharge manuelle possible sans refonte :
    INSERT INTO shares_outstanding VALUES
      ('IONQ', '2026-03-31', 373000000, 'SEC 10-Q 2026-03-31')
    ON CONFLICT (ticker, as_of_date)
    DO UPDATE SET shares = EXCLUDED.shares, source = EXCLUDED.source;
"""

import os
import sys
from datetime import date  # noqa: F401 — utilisé par market_data via import *

from dotenv import load_dotenv
from supabase import create_client

from market_data import check_ticker_coverage, fetch_shares_outstanding

load_dotenv(dotenv_path="../.env.local")
load_dotenv()

# 12 sociétés sectorielles — QNTM.L, QQQ (ETF) et NVDA (infrastructure) exclus.
# Migration 005 : RGTI, QUBT, QNT | Migration 006 : XNDU, ARQQ, HQ
TICKERS = ["GOOGL", "IBM", "IONQ", "QBTS", "LAES", "INFQ", "RGTI", "QUBT", "QNT",
           "XNDU", "ARQQ", "HQ"]

# Valeurs de référence pour les alertes (sources primaires vérifiées)
_REF_SHARES: dict[str, tuple[int, str]] = {
    "IONQ": (373_000_000, "10-Q Q1 2026 (31/03/2026)"),
}
_ALERT_THRESHOLD = 0.10  # ±10 % → AVERTISSEMENT

# Notes de vigilance — affichées dans le tableau de contrôle (stderr), pas en base.
# Distinct de _MANUAL_OVERRIDES : ce sont des alertes éditoriales, pas des corrections de données.
_CAUTION_NOTES: dict[str, str] = {
    "ARQQ": (
        "⚠  ARQQ (Arqit Quantum) — PROFIL À RISQUE ÉLEVÉ :\n"
        "   Arqit est un cas documenté de quantum washing (analyse dédiée sur la chaîne).\n"
        "   Le chiffre d'actions (17,4 M) est très bas et peut évoluer après dilutions/opérations.\n"
        "   Vérifier sur SEC.gov avant usage. À NE PAS afficher sans la note d'avertissement."
    ),
}

# Surcharges manuelles — priment sur yfinance (as_of_date plus récente → ORDER BY as_of_date DESC).
# Upsertées automatiquement à chaque exécution (idempotent).
_MANUAL_OVERRIDES: list[dict] = [
    {
        "ticker":     "QNT",
        "as_of_date": "2026-06-05",
        "shares":     322_000_000,
        # Source : prospectus 424B4 SEC, 04/06/2026.
        # Structure Up-C : Class A cotée ~32,86 M ≈ 10,2 % de l'intérêt économique total.
        # Valeur pleinement diluée = 32,86 M / 10,2 % ≈ 322 M actions (Class A + Common Units B).
        "source":     "SEC 424B4 2026-06-04 (fully-diluted, Up-C structure)",
    },
]
_OVERRIDE_MAP: dict[str, dict] = {o["ticker"]: o for o in _MANUAL_OVERRIDES}

# Notes d'affichage par ticker — décrivent pourquoi la valeur diffère de yfinance.
# À réutiliser lors de l'implémentation du tableau frontend (S1 Étape C).
_DISPLAY_NOTES: dict[str, str] = {
    "QNT": "market cap pleinement diluée — structure Up-C, flottant Class A ≈ 10 %",
}


def _fmt_mcap(usd: float) -> str:
    if usd >= 1e12:
        return f"{usd / 1e12:.2f} T$"
    if usd >= 1e9:
        return f"{usd / 1e9:.1f} G$"
    return f"{usd / 1e6:.0f} M$"


def main() -> None:
    db = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_KEY"])

    # ── 0. Preuve de couverture yfinance pour QNT (IPO 04/06/2026) ────────────
    print("\nVérification couverture yfinance pour QNT (IPO 04/06/2026)…")
    qnt_covered = check_ticker_coverage("QNT", date(2026, 6, 4))
    if qnt_covered:
        print("  ✓ QNT (Quantinuum) — couvert par yfinance depuis le 04/06/2026")
    else:
        print("  ✗ QNT — NON COUVERT par yfinance. Vérifier le ticker NASDAQ et relancer.", file=sys.stderr)

    # ── 1. Fetch yfinance (ticker par ticker) ──────────────────────────────────
    print(f"\nRécupération shares outstanding via yfinance ({len(TICKERS)} tickers)…")
    fetched: list[dict] = []
    errors: list[str] = []

    for ticker in TICKERS:
        try:
            data = fetch_shares_outstanding(ticker)
            fetched.append({
                "ticker":     ticker,
                "as_of_date": str(data["as_of_date"]),
                "shares":     data["shares"],
                "source":     data["source"],
            })
            print(f"  ✓ {ticker:<6}  {data['shares'] / 1_000_000:,.1f} M  ({data['as_of_date']})")
        except Exception as exc:
            errors.append(ticker)
            print(f"  ✗ {ticker} — {exc}", file=sys.stderr)

    # ── 2. Derniers cours depuis Supabase (pour la market cap de contrôle) ─────
    latest_prices: dict[str, tuple[float, str]] = {}
    if fetched:
        tickers_ok = [r["ticker"] for r in fetched]
        prices_res = (
            db.table("price_daily")
            .select("ticker, adj_close, date")
            .in_("ticker", tickers_ok)
            .order("date", desc=True)
            .execute()
        )
        seen: set[str] = set()
        for row in prices_res.data or []:
            t = row["ticker"]
            if t not in seen:
                latest_prices[t] = (float(row["adj_close"]), str(row["date"]))
                seen.add(t)

    # ── 3. Tableau de contrôle ─────────────────────────────────────────────────
    print()
    header = f"{'Ticker':<7} {'Actions (M)':<14} {'Date source':<14} {'Cours':<10} {'Market Cap':<14} Source"
    print(header)
    print("─" * len(header))

    alerts: list[str] = []
    for r in fetched:
        ticker = r["ticker"]

        # Surcharge manuelle si as_of_date plus récente que la valeur yfinance
        override = _OVERRIDE_MAP.get(ticker)
        d = r if (not override or override["as_of_date"] <= r["as_of_date"]) else {**r, **override}

        shares_m   = d["shares"] / 1_000_000
        price_info = latest_prices.get(ticker)

        if price_info:
            price, price_date = price_info
            mcap_str  = _fmt_mcap(d["shares"] * price)
            price_str = f"${price:,.2f}"
        else:
            mcap_str  = "N/A"
            price_str = "N/A"

        print(
            f"{ticker:<7} {shares_m:<14,.1f} {d['as_of_date']:<14} "
            f"{price_str:<10} {mcap_str:<14} {d['source']}"
        )
        if ticker in _DISPLAY_NOTES:
            print(f"        ↳ {_DISPLAY_NOTES[ticker]}")

        # Alerte si écart > seuil vs valeur de référence primaire (sur valeur yfinance brute)
        if ticker in _REF_SHARES:
            ref, ref_label = _REF_SHARES[ticker]
            ratio = abs(r["shares"] - ref) / ref
            if ratio > _ALERT_THRESHOLD:
                alerts.append(
                    f"⚠  {ticker} : yfinance={r['shares'] / 1_000_000:.1f} M vs référence={ref / 1_000_000:.1f} M "
                    f"({ref_label}) — écart {ratio * 100:.1f} %. "
                    f"Vérifier sur SEC.gov et surcharger manuellement si nécessaire."
                )

    print()

    # ── 4. Alertes écart de référence ─────────────────────────────────────────
    if alerts:
        print("AVERTISSEMENTS :", file=sys.stderr)
        for a in alerts:
            print(a, file=sys.stderr)
        print()

    # ── 4c. Notes de vigilance (éditoriales) ──────────────────────────────────
    caution_hits = [r for r in fetched if r["ticker"] in _CAUTION_NOTES]
    if caution_hits:
        print("\nNOTES DE VIGILANCE :", file=sys.stderr)
        for r in caution_hits:
            print(_CAUTION_NOTES[r["ticker"]], file=sys.stderr)
        print()

    # ── 5. Upsert ─────────────────────────────────────────────────────────────
    if fetched:
        db.table("shares_outstanding").upsert(fetched).execute()
        print(f"✓ {len(fetched)} ligne(s) yfinance upsertée(s) dans shares_outstanding.")
    if _MANUAL_OVERRIDES:
        db.table("shares_outstanding").upsert(_MANUAL_OVERRIDES).execute()
        print(f"✓ {len(_MANUAL_OVERRIDES)} surcharge(s) manuelle(s) upsertée(s) (prime sur yfinance via as_of_date).")

    # ── 6. Résumé final ────────────────────────────────────────────────────────
    if errors:
        print(
            f"\n✗ {len(errors)} ticker(s) en échec : {', '.join(errors)}\n"
            "  Relancer le script ou insérer manuellement.",
            file=sys.stderr,
        )
        sys.exit(1)

    print("\nPour ajouter une surcharge manuelle : éditer _MANUAL_OVERRIDES dans fetch_shares.py.")
    print("  ex. IONQ depuis SEC 10-Q — SQL direct :")
    print("    INSERT INTO shares_outstanding VALUES")
    print("      ('IONQ', '2026-03-31', 373000000, 'SEC 10-Q 2026-03-31')")
    print("    ON CONFLICT (ticker, as_of_date)")
    print("    DO UPDATE SET shares = EXCLUDED.shares, source = EXCLUDED.source;")


if __name__ == "__main__":
    main()
