-- 012 — C7 : journal des ajustements d'actions (splits / regroupements)
--
-- Contexte : l'historique du nombre d'actions n'a de sens que s'il est AJUSTÉ des
-- splits et regroupements. Sans ajustement, ARQQ afficherait 110 M actions en 2021
-- puis 11,5 M en 2024 — une « baisse » de 93 % qui n'a jamais eu lieu, alors que la
-- société a en réalité dilué ses porteurs (4,4 M → 11,5 M en base ajustée).
--
-- CE QUI EST STOCKÉ, ET CE QUI NE L'EST PAS :
-- Les valeurs écrites dans `shares_outstanding` sont DÉJÀ ajustées — elles viennent
-- du comparatif retraité par l'émetteur lui-même dans son dépôt le plus récent
-- (règle « à date de clôture égale, le dépôt le plus récent gagne », cf. edgar.py).
-- Aucun multiplicateur n'est appliqué par nos scripts, et il ne faut JAMAIS en
-- appliquer un : ce serait ajuster deux fois.
--
-- Cette table est le DOSSIER D'AUDIT de la détection : quel ratio, sur quelle date
-- de clôture, dans quel dépôt, et depuis quelle valeur d'origine. Elle sert à
-- (a) prouver l'ajustement en due diligence, (b) alimenter la note de méthode
-- affichée sur la fiche société, (c) détecter une régression si un futur dépôt
-- retraitait à nouveau les mêmes exercices.
--
-- Dérogation assumée au principe « ne jamais stocker le calculable » : un ratio de
-- split est un fait externe daté, pas un dérivé de `price_daily` — même nature que
-- `shares_outstanding` ou `sector_event`.
--
-- Idempotent (ON CONFLICT sur la PK). À appliquer manuellement dans le dashboard
-- Supabase AVANT `backfill_shares_history.py`.

create table if not exists share_adjustment (
  ticker         text      not null references asset(ticker),
  effective_date date      not null,   -- date de clôture de l'exercice retraité
  ratio          numeric   not null,   -- 25.0 = regroupement 25:1 ; 0.2 = division 1:5
  kind           text      not null check (kind in ('reverse_split', 'split')),
  source         text      not null,   -- dépôt SEC portant le comparatif retraité
  detected_from  bigint    not null,   -- valeur d'origine, avant retraitement
  detected_to    bigint    not null,   -- valeur retenue, après retraitement
  created_at     timestamptz not null default now(),
  primary key (ticker, effective_date)
);

comment on table share_adjustment is
  'C7 — journal d''audit des splits/regroupements détectés. Les valeurs de shares_outstanding sont déjà ajustées : ne JAMAIS appliquer ratio comme multiplicateur.';

-- Contrôle après application :
--   select ticker, effective_date, ratio, kind, detected_from, detected_to, source
--   from share_adjustment order by ticker, effective_date;
--
-- Attendu au 2026-08-15 : ARQQ, 3 lignes (2021-09-30, 2022-09-30, 2023-09-30),
-- ratio 25,0 — le regroupement 25:1 de septembre 2024 pour conformité Nasdaq.
