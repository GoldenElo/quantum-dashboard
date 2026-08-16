"""
C7 — persistance des liquidités, de la consommation et des dépôts déclarés.

Lit EDGAR (module `edgar.py`), écrit `company_financials` et `company_filing`.
Le front lit ensuite ces tables : il n'appelle JAMAIS la SEC lui-même (règle de
la maison, et EDGAR impose un User-Agent nominatif + 10 req/s).

Usage :  cd scripts && python3 fetch_financials.py [--dry-run] [TICKER ...]

  --dry-run   n'écrit rien, affiche exactement ce qui serait écrit.

Prérequis : migration 013 appliquée (dashboard Supabase). Absente ⇒ le script
s'arrête proprement en le disant, sans rien écrire ailleurs.

═══ LE RECOUPEMENT EST BLOQUANT, PAS INDICATIF ═══
Un ticker dont les liquidités extraites s'écartent de plus de 10 % du chiffre
publié par la société n'est PAS écrit. La règle vient d'un cas réel : une
extraction qui ignorait les placements non courants donnait 27,8 M$ à RGTI —
qui déclare 541,3 M$ et zéro dette — soit ~2 trimestres de runway affichés pour
une société qui en a plus de trente. Une fausse alerte de trésorerie est l'erreur
la plus coûteuse que ce module puisse commettre : elle est plausible, alarmante,
et elle survit à la relecture. Mieux vaut une section vide qu'un chiffre faux.

Les ancres de recoupement vivent dans `check_dilution._LIQUIDITY_ANCHORS` —
SOURCE UNIQUE, importée ici. Deux listes tenues à la main auraient divergé.

═══ CE QUI N'EST PAS ÉCRIT ═══
Le runway. Il se déduit de deux colonnes présentes, donc il se recalcule à la
lecture (principe « ne jamais stocker le calculable »). Le stocker le figerait
au jour de l'écriture alors que sa mise en forme — plafond à 5 ans, suppression
au-delà de 9 mois d'ancienneté — est une décision d'affichage.
"""

from __future__ import annotations

import logging
import os
import sys

from dotenv import load_dotenv
from supabase import Client, create_client

import edgar
from backfill_shares_history import DILUTION_TICKERS
from check_dilution import _LIQUIDITY_ANCHORS, _LIQUIDITY_TOLERANCE
from guards import emit_error, emit_warning

load_dotenv(dotenv_path="../.env.local")
load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
logger = logging.getLogger(__name__)


def _supabase_client() -> Client:
    return create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_KEY"])


def _iso(value) -> str | None:
    return value.isoformat() if value is not None else None


def main() -> None:
    dry_run = "--dry-run" in sys.argv
    tickers = [t.upper() for t in sys.argv[1:] if not t.startswith("--")] or DILUTION_TICKERS

    fin_rows: list[dict] = []
    filing_rows: list[dict] = []
    blocked: list[str] = []

    for ticker in tickers:
        cik = edgar.TICKER_CIK.get(ticker)
        if not cik:
            logger.info("%-5s — hors périmètre EDGAR, ignoré", ticker)
            continue

        try:
            fin = edgar.quarterly_cash_and_burn(cik)
        except Exception as exc:  # noqa: BLE001
            emit_warning("EDGAR injoignable", f"{ticker} — {exc}")
            continue

        if fin["cash"] is None:
            logger.info("%-5s — aucune trésorerie exploitable, ignoré (signalé, non comblé)", ticker)
            continue
        if not fin["source_url"]:
            # Un chiffre sans lien vers son dépôt ne se publie pas.
            emit_warning("Source absente", f"{ticker} — accession introuvable, ligne non écrite")
            continue

        anchor = _LIQUIDITY_ANCHORS.get(ticker)
        gap = fin["liquidity"] / anchor["value"] - 1 if anchor else None
        if gap is not None and abs(gap) > _LIQUIDITY_TOLERANCE:
            msg = (f"{ticker} — liquidités {fin['liquidity']:,} vs communiqué "
                   f"{anchor['value']:,} : écart {gap:+.1%} > {_LIQUIDITY_TOLERANCE:.0%}. "
                   f"Ligne NON écrite.")
            emit_error("Recoupement liquidités", msg)
            blocked.append(msg)
            continue

        fin_rows.append({
            "ticker": ticker,
            "as_of_date": _iso(fin["as_of"]),
            "cash": fin["cash"],
            "invest_current": fin["invest_current"],
            "invest_noncurrent": fin["invest_noncurrent"],
            "liquidity": fin["liquidity"],
            "burn_per_quarter": fin["burn_per_quarter"],
            "period_start": _iso(fin["period_start"]),
            "period_end": _iso(fin["period_end"]),
            "period_days": fin["period_days"],
            "source_form": fin["source_form"],
            "source_filed": fin["source_filed"],
            "source_url": fin["source_url"],
            "concepts": fin["concepts_used"],
            "crosscheck_value": anchor["value"] if anchor else None,
            "crosscheck_source": anchor["source"] if anchor else None,
        })

        try:
            for f in edgar.recent_filings(cik, edgar.SHELF_FORMS, limit=5):
                filing_rows.append({
                    "ticker": ticker,
                    "accession": f["accession"],
                    "form": f["form"],
                    "filed": _iso(f["filed"]),
                    "url": f["url"],
                })
        except Exception as exc:  # noqa: BLE001
            emit_warning("Dépôts déclarés", f"{ticker} — {exc}")

    for r in fin_rows:
        logger.info(
            "%-5s %s  liquidités %15s  (tr. %s + court %s + long %s)  conso/trim %s  [%s]",
            r["ticker"], r["as_of_date"], f"{r['liquidity']:,}",
            f"{r['cash']:,}",
            f"{r['invest_current']:,}" if r["invest_current"] else "—",
            f"{r['invest_noncurrent']:,}" if r["invest_noncurrent"] else "—",
            f"{r['burn_per_quarter']:,}" if r["burn_per_quarter"] else "—",
            r["source_form"],
        )
    logger.info("%d ligne(s) de finances · %d dépôt(s) déclaré(s)", len(fin_rows), len(filing_rows))

    if blocked:
        logger.error("%d ticker(s) BLOQUÉ(S) par le recoupement — voir ci-dessus", len(blocked))

    if dry_run:
        logger.info("--dry-run : rien n'a été écrit.")
        sys.exit(1 if blocked else 0)

    db = _supabase_client()
    try:
        if fin_rows:
            db.table("company_financials").upsert(
                fin_rows, on_conflict="ticker,as_of_date"
            ).execute()
        if filing_rows:
            db.table("company_filing").upsert(
                filing_rows, on_conflict="ticker,accession"
            ).execute()
    except Exception as exc:  # noqa: BLE001
        emit_error("Écriture impossible",
                   f"migration 013 appliquée ? Détail : {exc}")
        sys.exit(1)

    logger.info("Écriture terminée.")
    sys.exit(1 if blocked else 0)


if __name__ == "__main__":
    main()
