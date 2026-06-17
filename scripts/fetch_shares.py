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

from market_data import fetch_shares_outstanding

load_dotenv(dotenv_path="../.env.local")
load_dotenv()

# Tickers non-ETF : QNTM.L et QQQ (category='etf') exclus de la market cap
TICKERS = ["GOOGL", "IBM", "NVDA", "IONQ", "QBTS", "LAES", "INFQ"]

# Valeurs de référence pour les alertes (sources primaires vérifiées)
_REF_SHARES: dict[str, tuple[int, str]] = {
    "IONQ": (373_000_000, "10-Q Q1 2026 (31/03/2026)"),
}
_ALERT_THRESHOLD = 0.10  # ±10 % → AVERTISSEMENT


def _fmt_mcap(usd: float) -> str:
    if usd >= 1e12:
        return f"{usd / 1e12:.2f} T$"
    if usd >= 1e9:
        return f"{usd / 1e9:.1f} G$"
    return f"{usd / 1e6:.0f} M$"


def main() -> None:
    db = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_KEY"])

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
        ticker   = r["ticker"]
        shares_m = r["shares"] / 1_000_000
        price_info = latest_prices.get(ticker)

        if price_info:
            price, price_date = price_info
            mcap_str  = _fmt_mcap(r["shares"] * price)
            price_str = f"${price:,.2f}"
        else:
            mcap_str  = "N/A"
            price_str = "N/A"

        print(
            f"{ticker:<7} {shares_m:<14,.1f} {r['as_of_date']:<14} "
            f"{price_str:<10} {mcap_str:<14} {r['source']}"
        )

        # Alerte si écart > seuil vs valeur de référence primaire
        if ticker in _REF_SHARES:
            ref, ref_label = _REF_SHARES[ticker]
            ratio = abs(r["shares"] - ref) / ref
            if ratio > _ALERT_THRESHOLD:
                alerts.append(
                    f"⚠  {ticker} : yfinance={shares_m:.1f} M vs référence={ref / 1_000_000:.1f} M "
                    f"({ref_label}) — écart {ratio * 100:.1f} %. "
                    f"Vérifier sur SEC.gov et surcharger manuellement si nécessaire."
                )

    print()

    # ── 4. Affichage des alertes ───────────────────────────────────────────────
    if alerts:
        print("AVERTISSEMENTS :", file=sys.stderr)
        for a in alerts:
            print(a, file=sys.stderr)
        print()

    # ── 5. Upsert ─────────────────────────────────────────────────────────────
    if fetched:
        db.table("shares_outstanding").upsert(fetched).execute()
        print(f"✓ {len(fetched)} ligne(s) upsertée(s) dans shares_outstanding.")

    # ── 6. Résumé final ────────────────────────────────────────────────────────
    if errors:
        print(
            f"\n✗ {len(errors)} ticker(s) en échec : {', '.join(errors)}\n"
            "  Relancer le script ou insérer manuellement.",
            file=sys.stderr,
        )
        sys.exit(1)

    print("\nPour surcharger une valeur (ex. IONQ depuis SEC) :")
    print("  INSERT INTO shares_outstanding VALUES")
    print("    ('IONQ', '2026-03-31', 373000000, 'SEC 10-Q 2026-03-31')")
    print("  ON CONFLICT (ticker, as_of_date)")
    print("  DO UPDATE SET shares = EXCLUDED.shares, source = EXCLUDED.source;")


if __name__ == "__main__":
    main()
