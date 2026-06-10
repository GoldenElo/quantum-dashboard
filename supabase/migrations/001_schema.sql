-- Migration 001 — Schéma initial Quantum Dashboard
-- Exécuter via : supabase db push  OU  directement dans l'éditeur SQL Supabase

-- ─────────────────────────────────────────────
-- Assets (actions, ETF)
-- ─────────────────────────────────────────────
create table if not exists asset (
  ticker    text primary key,
  name      text not null,
  category  text not null check (category in ('geant', 'infrastructure', 'pure_player', 'etf')),
  exchange  text not null,
  currency  text not null default 'USD'
);

-- ─────────────────────────────────────────────
-- Prix quotidiens (adj_close = référence)
-- ─────────────────────────────────────────────
create table if not exists price_daily (
  ticker    text    not null references asset (ticker),
  date      date    not null,
  close     numeric not null,
  adj_close numeric not null,
  volume    bigint,
  primary key (ticker, date)
);

-- ─────────────────────────────────────────────
-- Taux de change EUR/USD de clôture
-- ─────────────────────────────────────────────
create table if not exists fx_rate (
  pair  text    not null,  -- ex. 'EURUSD'
  date  date    not null,
  rate  numeric not null,
  primary key (pair, date)
);

-- ─────────────────────────────────────────────
-- Portefeuilles
-- ─────────────────────────────────────────────
create table if not exists portfolio (
  id                  text    primary key,  -- 'defensif' | 'dynamique' | 'agressif'
  name                text    not null,
  description         text,
  inception_date      date    not null,
  initial_capital_eur numeric not null default 10000
);

-- ─────────────────────────────────────────────
-- Positions (figées à l'inception)
-- ─────────────────────────────────────────────
create table if not exists position (
  portfolio_id  text    not null references portfolio (id),
  ticker        text    not null references asset (ticker),
  target_weight numeric not null,  -- poids à l'inception, ex. 0.40
  quantity      numeric not null,  -- figée à l'inception, fractionnaire autorisé
  primary key (portfolio_id, ticker)
);

-- ─────────────────────────────────────────────
-- Snapshots quotidiens (calculés par le cron)
-- ─────────────────────────────────────────────
create table if not exists snapshot_daily (
  portfolio_id  text    not null references portfolio (id),
  date          date    not null,
  value_eur     numeric not null,
  perf_cumul    numeric not null,  -- value_eur / initial_capital_eur - 1
  vol_30d       numeric,           -- annualisée (null si < 30 observations)
  vol_90d       numeric,
  max_drawdown  numeric,
  primary key (portfolio_id, date)
);

-- ─────────────────────────────────────────────
-- Index pour les requêtes fréquentes du front
-- ─────────────────────────────────────────────
create index if not exists idx_price_daily_date    on price_daily (date);
create index if not exists idx_snapshot_daily_date on snapshot_daily (date);
create index if not exists idx_fx_rate_date        on fx_rate (date);
