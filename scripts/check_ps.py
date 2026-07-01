"""
Tableau de contrôle du ratio P/S (price-to-sales) — LECTURE SEULE.
N'écrit RIEN en base. Sert à valider les chiffres AVANT tout affichage frontend
et avant la persistance par fetch_revenue.py.

Sources :
  - Chiffre d'affaires TTM : recalculé À LA VOLÉE depuis yfinance via
    market_data.fetch_revenue_ttm — DEUX mesures indépendantes par ticker
    (totalRevenue rapporté ET somme des 4 derniers trimestres). C'est le
    recoupement anti-erreur : les deux valeurs sont affichées côte à côte
    sur CHAQUE ligne, pas seulement quand elles divergent.
  - DEVISE DE REPORTING : yfinance renvoie totalRevenue dans la devise des états
    financiers (financialCurrency), PAS forcément en USD. Toute société qui ne
    rapporte pas en USD voit son CA converti en USD au dernier taux de clôture
    (fetch_fx_to_usd) AVANT le calcul du P/S — sinon le ratio mélange market cap
    (USD) et CA (devise étrangère) et est faux. La devise détectée et le taux
    utilisé sont affichés pour validation.
  - Prix (adj_close le plus récent) et actions en circulation : lus en base
    (price_daily, shares_outstanding). market_cap = shares × adj_close, exactement
    comme le tableau des capitalisations S1 (la surcharge QNT Up-C est déjà en base).
  - P/S = market_cap (USD) / revenue_ttm (USD) — calculé à la volée, JAMAIS stocké.

Garde-fous (le script signale, il ne masque jamais — l'humain tranche) :
  - Recoupement STRICT : écart > 5 % entre CA rapporté et Σ 4 trimestres → ⚑.
  - IPO récentes (< 4 trimestres cotés) : période « partiel — N T » et P/S marqué
    NON FIABLE (‡), jamais présenté comme un ratio ferme.
  - Recoupement impossible (CA rapporté sans détail trimestriel) : P/S marqué ‡.
  - CA quasi nul (P/S aberrant) : « n.s. » (non significatif) — ex. HQ.
  - Aucun CA publié : « — ».

Usage : cd scripts && python3 check_ps.py [TICKER ...]
Sans argument : les 12 tickers sectoriels.
"""

from __future__ import annotations

import os
import sys

from dotenv import load_dotenv
from supabase import create_client, Client

from market_data import fetch_revenue_ttm, fetch_fx_to_usd

load_dotenv(dotenv_path="../.env.local")
load_dotenv()

SECTORAL_TICKERS = [
    "GOOGL", "IBM", "IONQ", "QBTS", "LAES", "INFQ",
    "RGTI", "QUBT", "QNT", "XNDU", "ARQQ", "HQ",
]

# IPO récentes : TTM potentiellement incomplet (< 4 trimestres cotés) ou absent.
RECENT_IPOS = {"QNT", "XNDU", "INFQ", "HQ"}

# Écart de recoupement au-delà duquel les deux mesures du TTM sont jugées douteuses.
_RECOUP_THRESHOLD = 0.05  # 5 % strict

# Au-delà de ce P/S, le ratio est jugé non significatif (CA quasi nul).
_PS_ABSURD = 5000.0


def _supabase_client() -> Client:
    return create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_KEY"])


def _latest_prices(db: Client, tickers: list[str]) -> dict[str, tuple[float, str]]:
    out: dict[str, tuple[float, str]] = {}
    res = (
        db.table("price_daily")
        .select("ticker, adj_close, date")
        .in_("ticker", tickers)
        .order("date", desc=True)
        .execute()
    )
    for row in res.data or []:
        t = row["ticker"]
        if t not in out:
            out[t] = (float(row["adj_close"]), str(row["date"]))
    return out


def _latest_shares(db: Client, tickers: list[str]) -> dict[str, tuple[int, str]]:
    out: dict[str, tuple[int, str]] = {}
    res = (
        db.table("shares_outstanding")
        .select("ticker, shares, as_of_date")
        .in_("ticker", tickers)
        .order("as_of_date", desc=True)
        .execute()
    )
    for row in res.data or []:
        t = row["ticker"]
        if t not in out:
            out[t] = (int(row["shares"]), str(row["as_of_date"]))
    return out


def _fmt_rev(v: float | None) -> str:
    if v is None:
        return "—"
    if abs(v) >= 1e9:
        return f"{v / 1e9:.2f} G$"
    return f"{v / 1e6:.0f} M$"


def _fmt_mcap(v: float | None) -> str:
    if v is None:
        return "N/A"
    if v >= 1e12:
        return f"{v / 1e12:.2f} T$"
    if v >= 1e9:
        return f"{v / 1e9:.1f} G$"
    return f"{v / 1e6:.0f} M$"


def _fmt_pct(v: float | None) -> str:
    if v is None:
        return "—"
    return f"{v * 100:+.1f} %"


def main() -> None:
    tickers = [t.upper() for t in sys.argv[1:]] or SECTORAL_TICKERS
    db = _supabase_client()

    prices = _latest_prices(db, tickers)
    shares = _latest_shares(db, tickers)

    print(f"\nRécupération du CA TTM + devise via yfinance ({len(tickers)} tickers)…")
    revenues: dict[str, dict] = {}
    fetch_errors: list[str] = []
    for t in tickers:
        try:
            revenues[t] = fetch_revenue_ttm(t)
        except Exception as exc:  # noqa: BLE001
            fetch_errors.append(t)
            print(f"  ✗ {t} — {exc}", file=sys.stderr)

    # Taux de change par devise (mis en cache — plusieurs tickers peuvent partager une devise).
    fx_cache: dict[str, dict] = {}
    fx_errors: list[str] = []

    def _fx(ccy: str) -> dict | None:
        if ccy not in fx_cache:
            try:
                fx_cache[ccy] = fetch_fx_to_usd(ccy)
            except Exception as exc:  # noqa: BLE001
                fx_errors.append(f"{ccy} ({exc})")
                fx_cache[ccy] = None
        return fx_cache[ccy]

    # ── Tableau de contrôle ────────────────────────────────────────────────────
    print()
    header = (
        f"{'Ticker':<7} {'Dev':>4} {'CA rapp.$':>11} {'CA Σ4T$':>11} {'Écart':>8} "
        f"{'Trim.':>5} {'MarketCap':>10} {'P/S':>9}  Période"
    )
    print(header)
    print("─" * len(header))

    recoup_alerts: list[str] = []
    partial_notes: list[str] = []
    fx_used: dict[str, dict] = {}  # devise -> fx (pour la légende)

    for t in tickers:
        rev = revenues.get(t)
        if rev is None:
            print(f"{t:<7} {'ERREUR yfinance — voir stderr':>60}")
            continue

        ccy = (rev.get("financial_currency") or "?").upper()
        reported = rev["reported"]
        sum_4q = rev["sum_4q"]
        q = rev["quarters_used"]

        # Conversion en USD au dernier taux de clôture
        rate = 1.0
        ccy_ok = True
        if ccy not in ("USD", "?"):
            fx = _fx(ccy)
            if fx is None:
                ccy_ok = False
            else:
                rate = fx["rate"]
                fx_used[ccy] = fx
        reported_usd = reported * rate if (reported is not None and ccy_ok) else None
        sum_4q_usd = sum_4q * rate if (sum_4q is not None and ccy_ok) else None

        # Écart de recoupement (ratio → indépendant de la devise)
        if reported and sum_4q and reported != 0:
            ecart = (sum_4q - reported) / reported
        else:
            ecart = None

        # Market cap (identique à S1 : shares × dernière clôture, en USD)
        mcap = shares[t][0] * prices[t][0] if (t in shares and t in prices) else None

        # CA de référence USD pour le P/S : rapporté prioritaire, sinon Σ4T
        rev_ref_usd = reported_usd if reported_usd is not None else sum_4q_usd

        # Fiabilité / période
        firm = False
        if not ccy_ok:
            period = f"devise {ccy} NON convertie (FX indispo)"
        elif q >= 4:
            period = "complet — 4 trim."
            firm = rev_ref_usd is not None
        elif q >= 1:
            period = f"partiel — {q} trim. (IPO récente)"
            partial_notes.append(t)
        else:  # q == 0
            period = "TTM rapporté — recoupement impossible" if rev_ref_usd is not None else "aucun CA publié"

        # P/S
        if mcap is None or not rev_ref_usd or rev_ref_usd <= 0:
            ps_str = "—"
        else:
            ps = mcap / rev_ref_usd
            if ps > _PS_ABSURD:
                ps_str = "n.s."          # non significatif (CA quasi nul)
            elif firm:
                ps_str = f"{ps:,.1f}"
            else:
                ps_str = f"({ps:,.0f})‡"  # peu fiable — valeur indicative, jamais ferme

        # Marqueur recoupement strict
        ecart_str = _fmt_pct(ecart)
        if ecart is not None and abs(ecart) > _RECOUP_THRESHOLD:
            ecart_str = "⚑" + ecart_str
            recoup_alerts.append(t)

        print(
            f"{t:<7} {ccy:>4} {_fmt_rev(reported_usd):>11} {_fmt_rev(sum_4q_usd):>11} {ecart_str:>8} "
            f"{q:>5} {_fmt_mcap(mcap):>10} {ps_str:>9}  {period}"
        )

    print("─" * len(header))
    print()

    # ── Légende & notes ────────────────────────────────────────────────────────
    print("Légende :")
    print("  Dev = devise de reporting yfinance (financialCurrency) · CA rapp.$/Σ4T$ = CA CONVERTI en USD")
    print("  Écart = (Σ4T − rapporté) / rapporté · ⚑ = écart > 5 % (recoupement douteux)")
    print("  P/S ferme uniquement si 4 trim. + devise USD/convertie · ‡ = non fiable (partiel/non recoupé)")
    print("  n.s. = non significatif (CA quasi nul) · « — » = non calculable")
    if fx_used:
        print("  Taux FX appliqués (dernière clôture) : "
              + " · ".join(f"1 {c} = {fx['rate']:.4f} USD ({fx['date']})" for c, fx in sorted(fx_used.items())))
    print()

    if recoup_alerts:
        print(f"⚑ RECOUPEMENT — écart CA rapporté vs Σ4T > {_RECOUP_THRESHOLD*100:.0f} % : "
              f"{', '.join(recoup_alerts)}", file=sys.stderr)
        print("   Confronter aux états financiers officiels (SEC 10-Q/10-K) avant usage.", file=sys.stderr)
        print(file=sys.stderr)

    if partial_notes:
        print(f"TTM PARTIEL (< 4 trim.) — P/S non fiable (‡), jamais un ratio ferme : {', '.join(partial_notes)}")
        print("   IPO récentes attendues : " + ", ".join(sorted(RECENT_IPOS)))
        print()

    if fx_errors:
        print(f"✗ FX indisponible : {', '.join(fx_errors)} — CA non converti, P/S non calculé.", file=sys.stderr)
    if fetch_errors:
        print(f"✗ {len(fetch_errors)} ticker(s) sans CA récupérable : {', '.join(fetch_errors)}", file=sys.stderr)


if __name__ == "__main__":
    main()
