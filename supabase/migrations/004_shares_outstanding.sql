-- Migration 004 — Table shares_outstanding (S1 capitalisations boursières)
--
-- Stocke le nombre d'actions en circulation par ticker et par date de référence.
-- Historisée : la PK (ticker, as_of_date) permet de tracer l'évolution du flottant
-- (dilution, rachat d'actions) et de surcharger une valeur yfinance par une source
-- primaire officielle (ex. source = 'SEC 10-Q 2026-03-31').
--
-- market_cap_usd = shares × adj_close est TOUJOURS calculé à la volée (jamais stocké).
-- Seuls les tickers non-ETF sont concernés (GOOGL, IBM, NVDA, IONQ, QBTS, LAES, INFQ).
-- QNTM.L et QQQ (category = 'etf') sont exclus.

create table shares_outstanding (
  ticker      text        not null references asset(ticker),
  as_of_date  date        not null,
  shares      bigint      not null,
  source      text        not null,  -- 'yfinance' | 'SEC 10-Q 2026-03-31' | 'annual-report' | etc.
  primary key (ticker, as_of_date)
);

comment on table shares_outstanding is
  'Nombre d''actions en circulation par ticker, mis à jour trimestriellement. '
  'market_cap_usd = shares × adj_close est calculé à la volée, jamais stocké. '
  'Surcharge manuelle : insérer une ligne avec source = ''SEC 10-Q YYYY-MM-DD'' '
  'et as_of_date = date du rapport — elle prend le dessus via ORDER BY as_of_date DESC.';
