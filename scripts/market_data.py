"""
Couche d'accès aux données de marché — source V1 : Yahoo Finance (yfinance).
Tout appel réseau vers un fournisseur de données est centralisé ici.
En V2, remplacer les implémentations par des appels Twelve Data sans toucher
au reste du code.
"""

import time
import logging
from datetime import date, timedelta
from typing import Optional

import pandas as pd
import yfinance as yf

logger = logging.getLogger(__name__)

_MAX_ATTEMPTS = 3
_BACKOFF_BASE = 2  # secondes ; tentative n attend backoff_base^n secondes


def _retry(func):
    """Décorateur : 3 tentatives avec backoff exponentiel."""
    def wrapper(*args, **kwargs):
        last_exc: Optional[Exception] = None
        for attempt in range(_MAX_ATTEMPTS):
            try:
                return func(*args, **kwargs)
            except Exception as exc:
                last_exc = exc
                wait = _BACKOFF_BASE ** attempt
                logger.warning(
                    "Tentative %d/%d échouée pour %s : %s — retry dans %ds",
                    attempt + 1, _MAX_ATTEMPTS, args, exc, wait,
                )
                time.sleep(wait)
        raise RuntimeError(
            f"Échec après {_MAX_ATTEMPTS} tentatives"
        ) from last_exc
    return wrapper


@_retry
def fetch_adj_close(
    tickers: list[str],
    start: date,
    end: date,
) -> pd.DataFrame:
    """
    Retourne un DataFrame (index=date, colonnes=tickers) avec les adj_close.
    La colonne `end` est incluse (yfinance exclut end, donc on ajoute 1 jour).
    Lève RuntimeError si un ticker retourne un DataFrame vide.
    """
    end_excl = end + timedelta(days=1)
    raw = yf.download(
        tickers=tickers,
        start=start.isoformat(),
        end=end_excl.isoformat(),
        auto_adjust=True,   # renomme Close → adj_close implicitement
        progress=False,
        threads=True,
    )

    # yfinance renvoie un MultiIndex quand plusieurs tickers sont demandés
    if isinstance(raw.columns, pd.MultiIndex):
        df = raw["Close"]
    else:
        df = raw[["Close"]].rename(columns={"Close": tickers[0]})

    df.index = pd.to_datetime(df.index).date

    missing = [t for t in tickers if t not in df.columns or df[t].isna().all()]
    if missing:
        raise ValueError(f"Données manquantes pour : {missing}")

    return df


@_retry
def fetch_eurusd(start: date, end: date) -> pd.Series:
    """
    Retourne une Series (index=date) du taux EUR/USD de clôture.
    Ticker yfinance : EURUSD=X
    """
    end_excl = end + timedelta(days=1)
    raw = yf.download(
        tickers="EURUSD=X",
        start=start.isoformat(),
        end=end_excl.isoformat(),
        auto_adjust=True,
        progress=False,
    )

    if raw.empty:
        raise ValueError(f"Taux EUR/USD introuvable entre {start} et {end}")

    series = raw["Close"].squeeze()
    series.index = pd.to_datetime(series.index).date
    return series


def check_ticker_coverage(ticker: str, since: date) -> bool:
    """
    Vérifie qu'un ticker est disponible dans yfinance depuis `since`.
    Utile pour le point de contrôle INFQ.
    Retourne True si au moins une cotation existe à partir de cette date.
    """
    try:
        df = fetch_adj_close([ticker], start=since, end=date.today())
        return not df.empty and not df[ticker].isna().all()
    except Exception:
        return False
