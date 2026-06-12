-- Migration 003 : V1.5 — schéma portefeuille personnel
--
-- Étapes après cette migration :
--   1. python scripts/seed_personal.py   (insère le portefeuille + positions)
--   2. python scripts/ingest.py          (calcule les snapshots pour les 4 portefeuilles)

-- 1. Ajouter portfolio.type
ALTER TABLE portfolio
  ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'fictif'
  CONSTRAINT portfolio_type_check CHECK (type IN ('fictif', 'personnel'));

-- 2. Ajouter position.account
--    Sentinelle 'NONE' pour les portefeuilles fictifs (évite les NULLs dans la PK composite).
--    'CTO' ou 'PER' pour le portefeuille personnel.
ALTER TABLE position
  ADD COLUMN IF NOT EXISTS account text NOT NULL DEFAULT 'NONE'
  CONSTRAINT position_account_check CHECK (account IN ('NONE', 'CTO', 'PER'));

-- 3. Ajouter position.avg_cost_usd (PRU — null pour les portefeuilles fictifs)
ALTER TABLE position
  ADD COLUMN IF NOT EXISTS avg_cost_usd numeric;

-- 4. Remplacer la PK (portfolio_id, ticker) par (portfolio_id, ticker, account)
--    pour permettre GOOGL CTO + GOOGL PER dans le même portefeuille
ALTER TABLE position DROP CONSTRAINT position_pkey;
ALTER TABLE position ADD CONSTRAINT position_pkey
  PRIMARY KEY (portfolio_id, ticker, account);
