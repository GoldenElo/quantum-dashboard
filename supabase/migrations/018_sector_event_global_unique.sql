-- Migration 018 — Idempotence des ÉVÉNEMENTS GLOBAUX de sector_event (C6)
--
-- ⛔ DETTE LATENTE LEVÉE (relevée le 2026-09-03, corrigée avant la première écriture).
--
-- La migration 008 pose `unique (ticker, event_date, title)` et s'appuie dessus
-- pour l'upsert idempotent de seed_events.py. Cette contrainte NE S'APPLIQUE
-- JAMAIS aux événements globaux : en SQL, NULL n'est égal à rien, pas même à
-- NULL, donc deux lignes `ticker is null` de même date et de même titre ne se
-- heurtent à aucune unicité. Chaque relance de seed_events.py en aurait créé un
-- doublon, EN SILENCE — invisible jusqu'au jour où une page les afficherait
-- enfin, avec quatre copies.
--
-- La dette n'a jamais mordu parce qu'aucun événement global n'avait jamais été
-- saisi (vérifié le 2026-09-03 : 19 lignes en base, toutes rattachées à un
-- ticker). Elle est corrigée AVANT la première écriture, comme prévu, et livrée
-- avec la page /secteur qui rend ces événements.
--
-- Un index unique PARTIEL, plutôt qu'un index d'expression sur coalesce(ticker,'') :
-- l'index d'expression aurait rendu redondante la contrainte de 008 sans pouvoir
-- servir d'arbitre à l'`on_conflict=ticker,event_date,title` de PostgREST, qui
-- exige une unicité portant sur ces colonnes exactes. Les deux coexistent donc :
-- la contrainte de 008 pour les événements rattachés à un ticker, cet index pour
-- les globaux. Corollaire assumé : PostgREST ne sait pas non plus arbitrer sur un
-- index partiel, donc seed_events.py fait un select-puis-insert/update explicite
-- pour les lignes globales. L'index reste la GARANTIE DURE — même une écriture
-- SQL manuelle maladroite ne peut pas créer le doublon.
--
-- Idempotent (if not exists) — rejouable sans effet.

create unique index if not exists sector_event_global_unique_idx
  on sector_event (event_date, title)
  where ticker is null;

comment on index sector_event_global_unique_idx is
  'Unicite des evenements sectoriels GLOBAUX (ticker is null), que le unique '
  '(ticker, event_date, title) de la migration 008 ne couvre pas : en SQL NULL '
  'n''est egal a rien, la contrainte ne s''applique jamais a ces lignes.';
