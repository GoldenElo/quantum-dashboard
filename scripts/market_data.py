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


@_retry
def fetch_shares_outstanding(ticker: str) -> dict:
    """
    Retourne {'shares': int, 'as_of_date': date, 'source': str} pour un ticker.

    Utilise yf.Ticker.info['sharesOutstanding']. Si 'mostRecentQuarter' est
    disponible (timestamp Unix), l'utilise comme as_of_date ; sinon date.today().

    Source exclusive en V1 : 'yfinance'. La surcharge manuelle (SEC 10-Q, etc.)
    se fait directement en base via INSERT … ON CONFLICT DO UPDATE.
    """
    info = yf.Ticker(ticker).info
    shares = info.get("sharesOutstanding")
    if not shares:
        raise ValueError(f"sharesOutstanding non disponible pour {ticker}")
    mrq = info.get("mostRecentQuarter")
    as_of = date.fromtimestamp(mrq) if mrq else date.today()
    return {"shares": int(shares), "as_of_date": as_of, "source": "yfinance"}


_REVENUE_ROW_LABELS = ("Total Revenue", "TotalRevenue", "Operating Revenue")


@_retry
def fetch_revenue_ttm(ticker: str) -> dict:
    """
    Retourne les DEUX mesures du chiffre d'affaires TTM pour un ticker, afin de
    permettre le recoupement anti-erreur exigé (jamais une seule source) :

      {
        'ticker':        str,
        'reported':      float | None,  # totalRevenue TTM tel que rapporté (info)
        'sum_4q':        float | None,  # somme des 4 derniers trimestres publiés
        'quarters_used': int,           # nb de trimestres réellement sommés (0..4)
        'quarter_dates': list[str],     # dates (fin de trimestre) des trim. sommés, récent → ancien
        'as_of_date':    date,          # fin du trimestre le plus récent utilisé
        'source':        'yfinance',
      }

    `reported` provient de info['totalRevenue'] (TTM constitué côté Yahoo).
    `sum_4q` est recalculé à partir de l'état de résultat trimestriel — c'est le
    contrôle indépendant. Un écart notable entre les deux = donnée à confronter.

    Aucune des deux mesures n'est garantie : les IPO récentes cotent < 4 trimestres
    (quarters_used < 4 → TTM partiel) et certains pure-players pré-revenus n'ont
    aucun chiffre d'affaires publié (les deux à None, quarters_used = 0).
    """
    tk = yf.Ticker(ticker)
    info = tk.info

    reported_raw = info.get("totalRevenue")
    reported = float(reported_raw) if reported_raw not in (None, 0) else None

    # État de résultat trimestriel — API récente (quarterly_income_stmt) avec
    # repli sur l'ancien alias (quarterly_financials).
    qf = None
    for attr in ("quarterly_income_stmt", "quarterly_financials"):
        cand = getattr(tk, attr, None)
        if cand is not None and not cand.empty:
            qf = cand
            break

    quarters: list = []  # [(date, revenue), …]
    if qf is not None and not qf.empty:
        label = next((lbl for lbl in _REVENUE_ROW_LABELS if lbl in qf.index), None)
        if label is not None:
            row = qf.loc[label]
            for col, val in row.items():
                if pd.notna(val):
                    quarters.append((pd.to_datetime(col).date(), float(val)))

    quarters.sort(key=lambda x: x[0], reverse=True)  # plus récent en premier
    last4 = quarters[:4]
    quarters_used = len(last4)
    sum_4q = float(sum(v for _, v in last4)) if last4 else None

    if last4:
        as_of = last4[0][0]
    elif info.get("mostRecentQuarter"):
        as_of = date.fromtimestamp(info["mostRecentQuarter"])
    else:
        as_of = date.today()

    # Devise de reporting des états financiers — DISTINCTE de la devise de cotation
    # (info['currency']). totalRevenue et les trimestres sont exprimés dans CETTE
    # devise ; il faut la convertir en USD avant tout P/S (cf. fetch_fx_to_usd).
    fin_ccy = info.get("financialCurrency")

    return {
        "ticker":             ticker,
        "reported":           reported,
        "sum_4q":             sum_4q,
        "quarters_used":      quarters_used,
        "quarter_dates":      [d.isoformat() for d, _ in last4],
        "as_of_date":         as_of,
        "financial_currency": fin_ccy,
        "source":             "yfinance",
    }


@_retry
def fetch_fx_to_usd(currency: str) -> dict:
    """
    Retourne {'rate': float, 'pair': str, 'date': date | None} où `rate` = nombre
    d'USD pour 1 unité de `currency`, au dernier taux de clôture disponible.

    currency == 'USD' → {'rate': 1.0, 'pair': 'USD', 'date': None} (aucun appel réseau).
    Sinon, paire yfinance '{CUR}USD=X' (ex. CADUSD=X, GBPUSD=X, CHFUSD=X).
    Lève ValueError si la paire ne renvoie aucun taux.
    """
    cur = currency.upper()
    if cur == "USD":
        return {"rate": 1.0, "pair": "USD", "date": None}
    pair = f"{cur}USD=X"
    hist = yf.Ticker(pair).history(period="7d")
    close = hist["Close"].dropna() if hist is not None and not hist.empty else None
    if close is None or close.empty:
        raise ValueError(f"Taux de change indisponible pour {pair}")
    return {
        "rate": float(close.iloc[-1]),
        "pair": pair,
        "date": pd.to_datetime(close.index[-1]).date(),
    }
