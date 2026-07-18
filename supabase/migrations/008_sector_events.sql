-- Migration 008 — Table sector_event (C6, base d'événements sectoriels)
--
-- La MÉMOIRE ANNOTÉE du secteur quantique coté : une chronologie d'événements
-- sourcés (IPO, reverse split, dilution, contrat, résultats, réglementaire…),
-- saisie manuellement au fil de la veille éditoriale. C'est un moat par
-- accumulation — dans 18 mois, la seule chronologie annotée en français.
--
-- RÈGLE DE LA MAISON (dure) : source_url est NOT NULL. Aucun événement sans lien
-- vers une source primaire. La contrainte le garantit en base ; le script
-- seed_events.py le revérifie avant tout upsert.
--
-- ticker nullable : NULL = événement sectoriel GLOBAL (non rattaché à une société).
-- Les fiches /societe/[ticker] n'affichent que les événements de LEUR ticker ;
-- les événements globaux attendent une page secteur / la newsletter (C5).
--
-- Saisie : SQL direct dans Supabase, ou scripts/seed_events.py (liste Python
-- éditable). Pas d'interface d'admin pour l'instant (hors périmètre C6).
--
-- Idempotence du seed : la contrainte UNIQUE (ticker, event_date, title) permet
-- un upsert on_conflict — ré-exécuter seed_events.py ne crée aucun doublon.

create table sector_event (
  id            serial      primary key,
  ticker        text        references asset(ticker),   -- NULL = événement sectoriel global
  event_date    date        not null,
  type          text        not null check (type in (
                  'ipo', 'spac', 'reverse_split', 'dilution', 'contrat',
                  'resultats', 'acquisition', 'reglementaire', 'technologie', 'autre'
                )),
  title         text        not null,
  description   text,
  source_url    text        not null,                    -- OBLIGATOIRE — source primaire
  source_label  text,
  created_at    timestamptz not null default now(),
  unique (ticker, event_date, title)
);

create index sector_event_ticker_date_idx on sector_event (ticker, event_date desc);

comment on table sector_event is
  'Chronologie annotee du secteur quantique cote (C6). source_url NOT NULL = regle '
  'de la maison (aucun evenement sans source primaire). ticker NULL = evenement '
  'sectoriel global (non affiche sur les fiches individuelles). Saisie manuelle '
  'SQL ou scripts/seed_events.py. UNIQUE (ticker, event_date, title) = seed idempotent.';
