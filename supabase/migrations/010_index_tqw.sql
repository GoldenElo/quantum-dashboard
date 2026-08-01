-- Migration 010 — Indice TQW (C3) : tables index_daily et index_weights
--
-- L'Indice TQW est l'INDICE PROPRIÉTAIRE du Wall : la mesure agrégée du quantique
-- coté « pure-player », base 100 au 01/06/2026, pondérée par capitalisation totale
-- et plafonnée à 25 % par valeur. Avec sa méthodologie publiée
-- (docs/methodologie-indice-tqw.fr.md) et son historique accumulé, c'est de la
-- propriété intellectuelle licenciable — cessible indépendamment du site.
--
-- POURQUOI ON STOCKE (dérogation raisonnée au principe « ne jamais stocker le
-- calculable ») : la doctrine interdit de stocker ce qui se recalcule depuis
-- price_daily / asset — c'est pourquoi la market cap (S1), les variations (S2) et
-- le P/S (S-P/S) ne sont PAS stockés. Une valeur d'indice n'entre pas dans cette
-- catégorie : elle dépend d'une CHAÎNE DE DÉCISIONS DATÉES (univers éligible ce
-- jour-là, actions connues ce jour-là, facteurs de plafonnement figés au dernier
-- rebalancement, diviseur hérité). Elle n'est pas dérivable d'un prix : c'est une
-- décision historique, du même ordre que shares_outstanding (004) ou sector_event
-- (008). En revanche les POIDS COURANTS restent calculés à la volée côté lecture,
-- jamais stockés — eux sont bien dérivables des paramètres figés × le cours du jour.
--
-- NON-RÉTROACTIVITÉ (règle dure) : une valeur publiée n'est JAMAIS recalculée.
-- Un split réécrit adj_close rétroactivement et une surcharge SEC peut être
-- rétro-datée ; ni l'un ni l'autre ne doit altérer une série déjà publiée.
-- Les scripts n'écrivent que les dates manquantes ; check_index.py recalcule la
-- chaîne et SIGNALE toute dérive au lieu de l'écraser en silence.
--
-- Calcul : scripts/index_tqw.py (moteur), appelé par ingest.py à chaque clôture.
-- JAMAIS dans le front — /indice lit index_daily, il ne recalcule rien.

create table index_daily (
  date        date     primary key,
  value       numeric  not null,   -- valeur de l'indice, base 100 au 2026-06-01
  divisor     numeric  not null    -- diviseur en vigueur ce jour-là (issu du dernier rebalancement)
);

comment on table index_daily is
  'Serie quotidienne de l''Indice TQW (C3), base 100 au 2026-06-01. '
  'Indice(t) = somme(actions_R x cap_factor_R x adj_close_t) / divisor_R, ou R est le '
  'dernier rebalancement. Calculee par scripts/index_tqw.py dans l''ingestion, jamais '
  'dans le front. NON-RETROACTIVITE : une valeur publiee n''est jamais recalculee.';

create table index_weights (
  rebalance_date date     not null,  -- date EFFECTIVE du rebalancement (1re séance ≥ 1er fév/mai/août/nov)
  ticker         text     not null references asset(ticker),
  shares         bigint   not null,  -- actions figées à ce rebalancement (décision, pas un dérivé)
  price          numeric  not null,  -- adj_close du ticker à cette date (pièce justificative)
  weight_raw     numeric  not null,  -- poids par capitalisation AVANT plafond
  weight_capped  numeric  not null,  -- poids retenu APRÈS plafond (≤ 0.25)
  cap_factor     numeric  not null,  -- facteur figé jusqu'au prochain rebalancement (1.0 = non écrêté)
  shares_source  text     not null,  -- 'yfinance' | 'SEC 424B4 2026-06-04' | 'annual-report' | …
  primary key (rebalance_date, ticker)
);

create index index_weights_date_idx on index_weights (rebalance_date desc);

comment on table index_weights is
  'Composition figee de l''Indice TQW a chaque rebalancement trimestriel (fevrier, mai, '
  'aout, novembre). price / weight_raw / weight_capped sont redondants avec un recalcul '
  'mais constituent le DOSSIER D''AUDIT du rebalancement : ils doivent survivre a une '
  'revision ulterieure de price_daily (split) ou de shares_outstanding (surcharge SEC '
  'retro-datee). Le plafond de 25 %% ne s''applique QU''AU REBALANCEMENT — entre deux '
  'rebalancements les poids derivent librement avec les cours, et c''est voulu.';
