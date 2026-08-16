"""
C7 — Backfill de l'historique annuel du nombre d'actions depuis EDGAR (SEC).

Un point par exercice clos, ajusté des splits, chaque point portant le dépôt
exact dont il est issu. Alimente `shares_outstanding` (et `share_adjustment`
pour le journal d'audit des retraitements).

Usage :  cd scripts && python3 backfill_shares_history.py [--dry-run] [TICKER ...]

  --dry-run   n'écrit rien, affiche exactement ce qui serait écrit.
              À utiliser AVANT toute écriture ; check_dilution.py relit ensuite.

PÉRIMÈTRE — GOOGL et IBM sont exclus : la dilution n'est pas le sujet des géants
diversifiés, et leurs séries écraseraient le propos. Les 11 autres sociétés du
suivi sectoriel sont traitées ; celles dont le XBRL ne donne rien d'exploitable
(QNT, IQMX, XNDU, HQ, INFQ) sont signalées nommément, jamais comblées.

═══ GARDE-FOU DE NON-RÉGRESSION (invariant vérifié à l'exécution) ═══
Toute ligne écrite doit être STRICTEMENT ANTÉRIEURE à la ligne de tête actuelle
du ticker. La capitalisation, le P/S et l'Indice TQW lisent tous la ligne la plus
récente (`ORDER BY as_of_date DESC`) : cet invariant garantit qu'aucun chiffre
publié ne bouge. Une ligne qui deviendrait la nouvelle tête est REFUSÉE et
déclenche `emit_error` — on ne suppose pas l'invariant, on le vérifie.

Corollaire indice : les valeurs publiées de l'Indice TQW ne sont jamais
recalculées (règle de non-rétroactivité C3). Relancer `check_index.py` après ce
script ; en cas de dérive signalée, on documente, on ne réécrit pas la série.

═══ POINTS ANTÉRIEURS À LA COTATION ═══
EDGAR expose des exercices antérieurs à l'entrée en bourse (société privée, ou
coquille SPAC). Ils mesurent une autre entité : QBTS passe de 2,8 M actions
(2021) à 113,3 M (2022) — c'est une fusion SPAC, pas de la dilution. Ces points
ne sont PAS écrits en base : le graphique de la fiche et tout calcul de dilution
en hériteraient sans moyen de les distinguer. Ils sont listés en clair dans la
sortie, avec leur valeur et le motif d'exclusion.
"""

from __future__ import annotations

import logging
import os
import sys
from datetime import date

from dotenv import load_dotenv
from supabase import Client, create_client

import edgar
from guards import emit_error, emit_warning

load_dotenv(dotenv_path="../.env.local")
load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
logger = logging.getLogger(__name__)

BATCH_SIZE = 500

# Périmètre C7 : le suivi sectoriel MOINS les deux géants diversifiés.
DILUTION_TICKERS = [
    "IONQ", "QBTS", "LAES", "INFQ", "RGTI", "QUBT", "QNT", "XNDU", "ARQQ", "HQ", "IQMX",
]

# Première cotation publique de la société OPÉRATIONNELLE — pas de la coquille.
# EDGAR ne permet pas de la déduire : les premiers dépôts sont ceux du SPAC (le
# « premier dépôt IONQ » du 29/09/2020 est celui de dMY Technology III).
# Carte curée, à valider par la rédaction ; tout exercice clos AVANT cette date
# est exclu de la base.
TICKER_FIRST_LISTING: dict[str, date] = {
    "IONQ": date(2021, 10, 1),   # fusion dMY III finalisée le 30/09/2021
    "QBTS": date(2022, 8, 8),    # fusion DPCM Capital finalisée le 05/08/2022
    "RGTI": date(2022, 3, 2),    # fusion Supernova Partners II
    "QUBT": date(2019, 1, 9),    # enregistrement SEC (Form 10-12G) ; Nasdaq en 07/2021
    "ARQQ": date(2021, 9, 3),    # fusion Centricus Acquisition
    "LAES": date(2023, 5, 23),   # scission de WISeKey, cotation Nasdaq
    "INFQ": date(2026, 2, 17),   # cf. CLAUDE.md
    "XNDU": date(2026, 3, 27),
    "HQ":   date(2026, 3, 20),
    "QNT":  date(2026, 6, 4),
    "IQMX": date(2026, 7, 2),
}


def _supabase_client() -> Client:
    return create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_KEY"])


def _upsert_batched(db: Client, table: str, rows: list[dict]) -> None:
    for i in range(0, len(rows), BATCH_SIZE):
        db.table(table).upsert(rows[i : i + BATCH_SIZE]).execute()


def _current_head(db: Client, tickers: list[str]) -> dict[str, dict]:
    """Ligne la plus récente par ticker — celle que lisent capi, P/S et indice."""
    res = (
        db.table("shares_outstanding")
        .select("ticker, as_of_date, shares, source")
        .in_("ticker", tickers)
        .order("as_of_date", desc=True)
        .execute()
    )
    head: dict[str, dict] = {}
    for row in res.data or []:
        head.setdefault(row["ticker"], row)
    return head


def _existing_pks(db: Client, tickers: list[str]) -> dict[tuple[str, str], dict]:
    res = (
        db.table("shares_outstanding")
        .select("ticker, as_of_date, shares, source")
        .in_("ticker", tickers)
        .execute()
    )
    return {(r["ticker"], r["as_of_date"]): r for r in res.data or []}


def main() -> None:
    args = sys.argv[1:]
    dry_run = "--dry-run" in args
    tickers = [a.upper() for a in args if not a.startswith("--")] or DILUTION_TICKERS

    db = _supabase_client()
    head = _current_head(db, tickers)
    existing = _existing_pks(db, tickers)

    to_write: list[dict] = []
    adjustments: list[dict] = []
    refused: list[str] = []
    summary: list[tuple] = []

    for ticker in tickers:
        cik = edgar.TICKER_CIK.get(ticker)
        if cik is None:
            refused.append(f"{ticker} — absent de TICKER_CIK")
            continue

        try:
            result = edgar.annual_share_counts(cik)
        except Exception as exc:  # noqa: BLE001
            emit_error("EDGAR injoignable", f"{ticker} — {exc}")
            refused.append(f"{ticker} — EDGAR injoignable : {exc}")
            continue

        listing = TICKER_FIRST_LISTING.get(ticker)
        kept, pre_listing, blocked = [], [], []

        for p in result["points"]:
            # 1. Exercice clos avant la cotation → autre entité, jamais écrit.
            if listing is not None and p["as_of_date"] < listing:
                pre_listing.append(p)
                continue
            # 2. Invariant de non-régression : jamais de nouvelle tête.
            h = head.get(ticker)
            if h is not None and p["as_of_date"].isoformat() >= h["as_of_date"]:
                blocked.append(p)
                emit_error(
                    "Historique actions — ligne refusée",
                    f"{ticker} {p['as_of_date']} deviendrait la ligne de tête "
                    f"(tête actuelle {h['as_of_date']}, source {h['source']}) — "
                    f"capitalisation, P/S et indice s'en trouveraient modifiés.",
                )
                continue
            kept.append(p)

        for p in kept:
            src = (
                f"SEC {p['form']} {p['filed'].isoformat()} "
                f"(EDGAR {result['concept']})"
            )
            pk = (ticker, p["as_of_date"].isoformat())
            prev = existing.get(pk)
            if prev is not None and int(prev["shares"]) != p["shares"]:
                emit_warning(
                    "Historique actions — valeur remplacée",
                    f"{ticker} {pk[1]} : {int(prev['shares']):,} ({prev['source']}) "
                    f"→ {p['shares']:,} (SEC). La source primaire prime.",
                )
            to_write.append({
                "ticker": ticker,
                "as_of_date": pk[1],
                "shares": p["shares"],
                "source": src,
            })
            if p["restated_from"]:
                adjustments.append({
                    "ticker": ticker,
                    "effective_date": pk[1],
                    "ratio": p["ratio"],
                    "kind": "reverse_split" if p["ratio"] > 1 else "split",
                    "source": src,
                    "detected_from": p["restated_from"],
                    "detected_to": p["shares"],
                })

        for motif in result["rejected"]:
            refused.append(f"{ticker} — {motif}")
        summary.append((ticker, result["concept"], kept, pre_listing, blocked))

    _print_report(summary, adjustments, refused, to_write, dry_run)

    if dry_run:
        logger.info("--dry-run : aucune écriture.")
        return
    if not to_write:
        logger.warning("Aucune ligne à écrire.")
        return

    _upsert_batched(db, "shares_outstanding", to_write)
    logger.info("%d lignes écrites dans shares_outstanding.", len(to_write))

    if adjustments:
        try:
            _upsert_batched(db, "share_adjustment", adjustments)
            logger.info("%d ajustements journalisés dans share_adjustment.", len(adjustments))
        except Exception as exc:  # noqa: BLE001
            emit_warning(
                "share_adjustment indisponible",
                f"migration 012 non appliquée ? — {exc}. L'historique des actions "
                f"est écrit, seul le journal d'audit manque.",
            )


def _print_report(summary, adjustments, refused, to_write, dry_run) -> None:
    title = "BACKFILL HISTORIQUE DES ACTIONS — EDGAR" + ("  [DRY-RUN]" if dry_run else "")
    print(f"\n{title}")
    print("═" * 96)

    for ticker, concept, kept, pre_listing, blocked in summary:
        print(f"\n{ticker}  —  {concept or 'aucun concept exploitable'}")
        if not kept and not pre_listing:
            print("   (aucun point annuel)")
        for p in kept:
            mark = ""
            if p["restated_from"]:
                mark = f"   ⇦ ajusté depuis {p['restated_from']:,} (ratio {p['ratio']:g}:1)"
            print(f"   ✔ {p['as_of_date']}  {p['shares']:>15,}  {p['form']:6} "
                  f"déposé {p['filed']}{mark}")
        for p in pre_listing:
            print(f"   ⊘ {p['as_of_date']}  {p['shares']:>15,}  exclu — exercice clos avant "
                  f"la première cotation (société privée / coquille SPAC)")
        for p in blocked:
            print(f"   ✗ {p['as_of_date']}  {p['shares']:>15,}  REFUSÉ — deviendrait la ligne de tête")

    if adjustments:
        print("\nAJUSTEMENTS DÉTECTÉS (journal d'audit)")
        print("─" * 96)
        for a in adjustments:
            print(f"   {a['ticker']:6} {a['effective_date']}  {a['kind']:14} ratio {a['ratio']:g}"
                  f"   {a['detected_from']:,} → {a['detected_to']:,}")

    if refused:
        print("\nSANS DONNÉE EXPLOITABLE — signalé, jamais comblé")
        print("─" * 96)
        for r in refused:
            print(f"   ⚠ {r}")

    print(f"\n{'─' * 96}")
    print(f"{len(to_write)} ligne(s) à écrire dans shares_outstanding.\n")


if __name__ == "__main__":
    main()
