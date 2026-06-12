-- Migration 002 : remplacement du benchmark QTUM par QNTM.L
-- VanEck Quantum Computing UCITS ETF (LSE, ticker yfinance : QNTM.L, devise : USD)
--
-- Étapes après cette migration :
--   1. python scripts/backfill.py   (re-peuple price_daily pour QNTM.L depuis l'inception)
--   2. python scripts/ingest.py     (recalcule les snapshots avec le nouveau benchmark)

-- 1. Supprimer les prix de l'ancien benchmark (FK avant l'asset)
DELETE FROM price_daily WHERE ticker = 'QTUM';

-- 2. Supprimer l'asset QTUM
DELETE FROM asset WHERE ticker = 'QTUM';

-- 3. Insérer le nouvel asset (idempotent)
INSERT INTO asset (ticker, name, category, exchange, currency)
VALUES ('QNTM.L', 'VanEck Quantum Computing UCITS ETF', 'etf', 'LSE', 'USD')
ON CONFLICT (ticker) DO UPDATE SET
  name     = EXCLUDED.name,
  category = EXCLUDED.category,
  exchange = EXCLUDED.exchange,
  currency = EXCLUDED.currency;
