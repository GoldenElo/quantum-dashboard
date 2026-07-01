-- Migration 007 — Table revenue_ttm (ratio P/S, suivi sectoriel)
--
-- Chiffre d'affaires sur 12 mois glissants (TTM) par ticker. Donnée fondamentale
-- EXTERNE, NON calculable depuis price_daily / asset → elle est stockée, comme
-- shares_outstanding (migration 004). Le P/S lui-même (market_cap / revenue_ttm)
-- est TOUJOURS calculé à la volée côté API, jamais stocké — cohérent avec la
-- market cap (S1) et les variations (S2).
--
-- Recoupement anti-erreur (garde-fou dur) : on conserve les DEUX mesures du TTM
--   revenue_reported : totalRevenue TTM tel que rapporté par la source (info) ;
--   revenue_sum_4q   : somme des 4 derniers trimestres publiés (financials).
-- Un écart > 5 % entre les deux = donnée douteuse à confronter (voir check_ps.py).
-- quarters_used < 4 → TTM PARTIEL (IPO récente) : P/S peu fiable, à ne jamais
-- afficher comme un ratio ferme.
--
-- Historisée par (ticker, as_of_date) comme shares_outstanding : une surcharge
-- manuelle depuis une source primaire (SEC 10-Q/10-K) prend le dessus via
-- ORDER BY as_of_date DESC.
--
-- Périmètre : 12 tickers sectoriels non-ETF (GOOGL, IBM, IONQ, QBTS, LAES, INFQ,
-- RGTI, QUBT, QNT, XNDU, ARQQ, HQ). NVDA, QNTM.L et QQQ exclus.

-- DEVISE : revenue_reported / revenue_sum_4q sont stockés dans la devise de
-- reporting NATIVE (financial_currency). Le front calcule le CA en USD via
-- revenue × fx_rate, puis P/S = market_cap / (CA en USD). Ne JAMAIS calculer un
-- P/S en mélangeant market cap (USD) et CA en devise étrangère. Aujourd'hui les
-- 12 sociétés rapportent en USD (SEC foreign private issuers) → fx_rate = 1.0 ;
-- les colonnes existent pour absorber sans refonte un futur ticker non-USD.

create table revenue_ttm (
  ticker            text     not null references asset(ticker),
  as_of_date        date     not null,   -- fin du trimestre le plus récent utilisé
  revenue_reported  numeric,             -- TTM rapporté (totalRevenue), devise native, null si absent
  revenue_sum_4q    numeric,             -- somme des 4 derniers trimestres, devise native, null si < 4Q
  quarters_used     int      not null,   -- nb de trimestres réellement sommés (0..4)
  financial_currency text    not null default 'USD',  -- devise de reporting (yfinance financialCurrency)
  fx_rate           numeric  not null default 1.0,    -- USD pour 1 unité de financial_currency (dern. clôture)
  source            text     not null,   -- 'yfinance' | 'SEC 10-Q YYYY-MM-DD' | 'annual-report'
  primary key (ticker, as_of_date)
);

comment on table revenue_ttm is
  'Chiffre d''affaires TTM par ticker (donnee externe, devise native). '
  'CA USD = revenue x fx_rate ; P/S = market_cap / CA USD, calcule a la volee, jamais stocke. '
  'revenue_reported vs revenue_sum_4q = recoupement anti-erreur (ecart > 5 %% = douteux). '
  'quarters_used < 4 = TTM partiel (IPO recente), P/S peu fiable. '
  'Surcharge manuelle via source primaire + as_of_date recente.';
