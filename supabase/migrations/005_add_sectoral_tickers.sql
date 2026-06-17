-- Ajout des tickers sectoriels : QNT (Quantinuum), RGTI (Rigetti), QUBT (Quantum Computing Inc.)
--
-- QNT  : IPO Nasdaq le 04/06/2026 (clôture le 05/06/2026).
--        Structure double classe : Class A cotée + Class B détenue par Honeywell.
--        market_cap yfinance = Class A seulement → sous-estimation probable.
--        Surcharger manuellement dans shares_outstanding après vérification SEC S-1.
--
-- RGTI : Rigetti Computing — pure-player, suivi sectoriel uniquement (hors portefeuilles).
-- QUBT : Quantum Computing Inc. — pure-player, suivi sectoriel uniquement (hors portefeuilles).
--
-- ON CONFLICT DO NOTHING : idempotent — sans effet si déjà présents.

INSERT INTO asset (ticker, name, category, exchange, currency) VALUES
  ('QNT',  'Quantinuum',                 'pure_player', 'NASDAQ', 'USD'),
  ('RGTI', 'Rigetti Computing',          'pure_player', 'NASDAQ', 'USD'),
  ('QUBT', 'Quantum Computing Inc',      'pure_player', 'NASDAQ', 'USD')
ON CONFLICT (ticker) DO NOTHING;
