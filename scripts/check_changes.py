"""
Tableau de contrôle des variations multi-horizons (S2) — LECTURE SEULE.
N'écrit RIEN en base. Sert à valider les variations avant l'affichage frontend.

Variations en jours DE COTATION (séances), car price_daily ne contient que des séances :
  - Jour    = close[-1] / close[-2]   − 1   (offset 1)
  - Semaine = close[-1] / close[-6]   − 1   (offset 5)
  - Mois    = close[-1] / close[-22]  − 1   (offset 21)
  - Année   = close[-1] / close[-253] − 1   (offset 252)
Historique insuffisant pour un horizon (IPO récente) → « — ».

Usage : cd scripts && python3 check_changes.py [TICKER ...]
Sans argument : affiche les 12 tickers sectoriels.
"""

from __future__ import annotations

import os
import sys
from collections import defaultdict

from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv(dotenv_path="../.env.local")
load_dotenv()

SECTORAL_TICKERS = [
    "GOOGL", "IBM", "IONQ", "QBTS", "LAES", "INFQ",
    "RGTI", "QUBT", "QNT", "XNDU", "ARQQ", "HQ", "IQMX",
]

# (libellé, offset en séances)
HORIZONS = [("Jour", 1), ("Semaine", 5), ("Mois", 21), ("Année", 252)]

# Seuil d'alerte sur la variation hebdomadaire : au-delà, le ticker est SIGNALÉ
# pour vérification manuelle — JAMAIS masqué. L'humain tranche entre vraie
# variation (forte volatilité post-IPO/SPAC) et artefact de données.
_WEEKLY_ALERT_THRESHOLD = 1.50  # ±150 %


def _supabase_client() -> Client:
    return create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_KEY"])


# 253 séances suffisent pour tous les horizons (offset annuel = 252). On lit
# par ticker (requête bornée bien sous le plafond PostgREST de 1000 lignes).
_WINDOW_SESSIONS = 260


def _load_closes(db: Client, tickers: list[str]) -> dict[str, list[tuple[str, float]]]:
    """{ticker: [(date, adj_close), …]} trié par date croissante (fenêtre récente)."""
    by_ticker: dict[str, list[tuple[str, float]]] = defaultdict(list)
    for ticker in tickers:
        res = (
            db.table("price_daily")
            .select("date, adj_close")
            .eq("ticker", ticker)
            .order("date", desc=True)
            .limit(_WINDOW_SESSIONS)
            .execute()
        )
        # remis en ordre croissant pour le calcul des offsets
        for row in reversed(res.data or []):
            by_ticker[ticker].append((row["date"], float(row["adj_close"])))
    return by_ticker


def _change(closes: list[float], offset: int) -> float | None:
    """Variation sur `offset` séances, ou None si historique insuffisant."""
    if len(closes) <= offset:
        return None
    last = closes[-1]
    past = closes[-1 - offset]
    if past == 0:
        return None
    return last / past - 1.0


def _fmt(pct: float | None) -> str:
    if pct is None:
        return "—"
    return f"{pct * 100:+.2f} %".replace(".", ",")


def main() -> None:
    tickers = [t.upper() for t in sys.argv[1:]] or SECTORAL_TICKERS
    db = _supabase_client()
    data = _load_closes(db, tickers)

    W = 78
    print()
    print("─" * W)
    print(f"  {'Ticker':<8} {'Séances':>7} {'Dern. clôture':<13} "
          + " ".join(f"{lbl:>10}" for lbl, _ in HORIZONS))
    print("─" * W)

    alerts: list[tuple[str, float]] = []
    for ticker in tickers:
        series = data.get(ticker, [])
        n = len(series)
        if n == 0:
            print(f"  {ticker:<8} {'0':>7} {'—':<13} " + " ".join(f"{'ABSENT':>10}" for _ in HORIZONS))
            continue
        last_date = series[-1][0]
        closes = [c for _, c in series]
        cells = [_fmt(_change(closes, off)) for _, off in HORIZONS]
        # Marqueur ⚑ sur la cellule Semaine si elle dépasse le seuil d'alerte
        weekly = _change(closes, 5)
        flagged = weekly is not None and abs(weekly) > _WEEKLY_ALERT_THRESHOLD
        if flagged:
            cells[1] = "⚑ " + cells[1]
            alerts.append((ticker, weekly))
        print(f"  {ticker:<8} {n:>7} {last_date:<13} " + " ".join(f"{c:>10}" for c in cells))

    print("─" * W)
    print()
    short = [t for t in tickers if 0 < len(data.get(t, [])) <= 252]
    if short:
        print(f"IPO récentes (historique < 253 séances → « — » sur l'horizon annuel) : "
              f"{', '.join(short)}")
    if alerts:
        print()
        print(f"⚑ ALERTE VÉRIFICATION MANUELLE — variation hebdo > ±{_WEEKLY_ALERT_THRESHOLD*100:.0f} % "
              f"(signalé, NON masqué) :", file=sys.stderr)
        for ticker, wk in alerts:
            print(f"   {ticker} : {wk*100:+.1f} % sur 5 séances — confronter aux prix bruts "
                  f"(forte volatilité post-IPO/SPAC vs artefact de données).", file=sys.stderr)


if __name__ == "__main__":
    main()
