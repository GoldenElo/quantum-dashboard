-- 015 — C6 : deux types d'événements supplémentaires (gouvernance, partenariat)
--
-- POURQUOI. La liste fermée de la migration 008 couvrait le cycle de vie boursier
-- (ipo, spac, dilution, reverse_split, résultats, acquisition) et l'activité
-- (contrat, technologie, réglementaire). Deux familles récurrentes tombaient
-- systématiquement dans 'autre', qui ne dit rien au lecteur :
--
--   'gouvernance'  — composition d'un conseil, nomination d'un dirigeant, vote
--                    d'actionnaires. Trois occurrences immédiates : approbation de
--                    la fusion Pasqal par les actionnaires de Bleichroeder
--                    (25/08/2026), conseil de Pasqal Holding SA (27/08/2026),
--                    entrée de deux administrateurs chez IonQ (24/08/2026).
--   'partenariat'  — accord de recherche ou de déploiement SANS montant publié.
--                    Distinct de 'contrat', qui suppose une commande chiffrée :
--                    confondre les deux laisserait croire à un chiffre d'affaires
--                    là où il n'y a qu'un accord-cadre. Occurrence immédiate :
--                    Pasqal × KACST / NCQT (31/08/2026).
--
-- La liste RESTE FERMÉE — c'est sa raison d'être. On l'élargit par migration
-- explicite, jamais en passant le CHECK en texte libre.
--
-- MIROIRS À TENIR EN COHÉRENCE (une valeur ajoutée ici l'est aux quatre endroits) :
--   1. ce CHECK ;
--   2. ALLOWED_TYPES dans scripts/seed_events.py — sinon le seed REFUSE toute
--      écriture (validation exhaustive, jamais d'état partiel) ;
--   3. t.evenements.types dans src/i18n/fr.ts — sinon le badge affiche la valeur
--      brute de la base ;
--   4. TYPE_FAMILY dans src/components/EventTimeline.tsx — sinon repli en gris.
--
-- LA CONTRAINTE DE 008 EST ANONYME (déclarée inline sur la colonne) : Postgres
-- l'a auto-nommée. Vérifier son nom réel AVANT d'appliquer :
--   select conname, pg_get_constraintdef(oid) from pg_constraint
--   where conrelid = 'sector_event'::regclass and contype = 'c';
-- Si le nom diffère de 'sector_event_type_check', adapter le DROP ci-dessous.
--
-- Idempotent (drop if exists + add). Élargir une liste ne peut pas échouer à la
-- revalidation des lignes existantes : toutes portent déjà un type de l'ancienne
-- liste, qui est incluse dans la nouvelle. À appliquer manuellement dans le
-- dashboard Supabase AVANT `seed_events.py`.

alter table sector_event
  drop constraint if exists sector_event_type_check;

alter table sector_event
  add constraint sector_event_type_check check (type in (
    'ipo', 'spac', 'reverse_split', 'dilution', 'contrat',
    'resultats', 'acquisition', 'reglementaire', 'technologie', 'autre',
    'gouvernance', 'partenariat'
  ));

-- Contrôle après application — la définition doit lister les 12 valeurs :
--   select conname, pg_get_constraintdef(oid) from pg_constraint
--   where conrelid = 'sector_event'::regclass and contype = 'c';
--
-- Et le refus doit tenir (doit échouer avec une violation de contrainte) :
--   insert into sector_event (ticker, event_date, type, title, source_url)
--   values ('IONQ', '2026-01-01', 'rumeur', 'test', 'https://example.com');
