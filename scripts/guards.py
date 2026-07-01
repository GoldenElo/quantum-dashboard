"""
Garde-fous partagés par fetch_shares.py et fetch_revenue.py.

Deux responsabilités :
  1. RÈGLE D'OR — une valeur dont la source est une surcharge manuelle
     ('SEC…' ou 'annual-report') est SANCTUARISÉE : yfinance ne doit jamais
     l'écraser. is_manual_source() sert de test unique côté appelant.
  2. ALERTES CI — sous GitHub Actions, on émet des annotations ::warning:: /
     ::error:: pour que tout écart suspect ressorte d'un coup d'œil dans les logs.
     En local, on retombe sur un message lisible sur stderr (aucune syntaxe CI).
"""

import os
import sys


def is_manual_source(source: str) -> bool:
    """True si la ligne est une surcharge manuelle sanctuarisée (jamais écrasée par yfinance)."""
    return source.startswith("SEC") or source.startswith("annual-report")


def _in_ci() -> bool:
    return os.environ.get("GITHUB_ACTIONS") == "true"


def emit_warning(title: str, msg: str) -> None:
    """Alerte non bloquante — à vérifier manuellement (dépôt SEC, etc.)."""
    if _in_ci():
        print(f"::warning title={title}::{msg}")
    else:
        print(f"⚠  {title} — {msg}", file=sys.stderr)


def emit_error(title: str, msg: str) -> None:
    """Alerte bloquante — contradiction ou incohérence à trancher."""
    if _in_ci():
        print(f"::error title={title}::{msg}")
    else:
        print(f"✗  {title} — {msg}", file=sys.stderr)
