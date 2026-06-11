"""
Couche d'accès aux données de marché — source V1 : Yahoo Finance (yfinance).
Tout appel réseau vers un fournisseur de données est centralisé ici.
En V2, remplacer les implémentations par des appels Twelve Data sans toucher
au reste du code.
"""

import time
import logging
from datetime import date, datetime, timedelta
from typing import Optional
from zoneinfo import ZoneInfo

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

    close = raw["Close"]
    # .squeeze() sur une Series à 1 élément renvoie un scalaire ; on l'évite.
    if isinstance(close, pd.DataFrame):
        close = close.iloc[:, 0]
    series = close.copy()
    series.index = pd.to_datetime(series.index).date
    return series


@_retry
def fetch_ohlcv(
    tickers: list[str],
    start: date,
    end: date,
) -> dict[str, pd.DataFrame]:
    """
    Retourne {ticker: DataFrame(index=date, cols=[close, adj_close, volume])}.
    auto_adjust=False → close brut + adj_close séparés.
    Lève ValueError si un ticker retourne des données entièrement nulles.
    """
    end_excl = end + timedelta(days=1)
    raw = yf.download(
        tickers=tickers,
        start=start.isoformat(),
        end=end_excl.isoformat(),
        auto_adjust=False,
        progress=False,
        threads=True,
    )
    raw.index = pd.to_datetime(raw.index).date

    if isinstance(raw.columns, pd.MultiIndex):
        close_df     = raw["Close"]
        adj_close_df = raw["Adj Close"]
        volume_df    = raw["Volume"]
    else:
        name = tickers[0]
        close_df     = raw[["Close"]].rename(columns={"Close": name})
        adj_close_df = raw[["Adj Close"]].rename(columns={"Adj Close": name})
        volume_df    = raw[["Volume"]].rename(columns={"Volume": name})

    missing = [
        t for t in tickers
        if t not in close_df.columns or close_df[t].isna().all()
    ]
    if missing:
        raise ValueError(f"Données manquantes pour : {missing}")

    result: dict[str, pd.DataFrame] = {}
    for ticker in tickers:
        df = pd.DataFrame({
            "close":     close_df[ticker],
            "adj_close": adj_close_df[ticker],
            "volume":    volume_df[ticker],
        }).dropna(subset=["close", "adj_close"])
        result[ticker] = df
    return result


_NYSE_TZ = ZoneInfo("America/New_York")
_NYSE_CLOSE_HOUR = 16  # 16h00 ET


def last_close_date() -> date:
    """
    Retourne la date de la dernière clôture NYSE complète.
    NYSE ferme à 16h00 ET. Avant cette heure (ou le week-end), on remonte
    au dernier jour de semaine où la clôture est passée.
    Ne tient pas compte des jours fériés US : yfinance retourne simplement
    moins de lignes ces jours-là.
    """
    now_et = datetime.now(tz=_NYSE_TZ)
    cutoff = now_et.replace(hour=_NYSE_CLOSE_HOUR, minute=0, second=0, microsecond=0)
    candidate = now_et.date() if now_et >= cutoff else (now_et - timedelta(days=1)).date()
    # Reculer jusqu'au dernier vendredi si week-end
    while candidate.weekday() >= 5:  # 5=samedi, 6=dimanche
        candidate -= timedelta(days=1)
    return candidate


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
