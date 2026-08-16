-- 013 — C7 : liquidités, consommation de trésorerie et dépôts déclarés
--
-- POURQUOI UNE TABLE, alors que le principe est « ne jamais stocker le calculable » :
-- ces chiffres ne se calculent pas, ils se LISENT dans un dépôt SEC daté. Même
-- nature que `shares_outstanding`, `revenue_ttm` ou `sector_event` — une donnée
-- externe, sourcée, dont l'accumulation est l'actif. Le front ne peut pas aller
-- les chercher lui-même : EDGAR impose un User-Agent nominatif et 10 req/s, et la
-- règle de la maison interdit au front tout appel à une source de données.
--
-- CE QUI N'EST PAS STOCKÉ : le RUNWAY. Il se déduit (liquidités ÷ consommation),
-- donc il se recalcule à la lecture — exactement comme la capitalisation (S1), les
-- variations (S2) et le P/S. Le stocker le figerait à la valeur du jour d'écriture.
--
-- HISTORIQUE CONSERVÉ. La PK porte sur (ticker, as_of_date) et non sur le seul
-- ticker : chaque trimestre publié s'empile au lieu d'écraser le précédent. La
-- lecture prend la ligne la plus récente (ORDER BY as_of_date DESC), comme partout
-- ailleurs. C'est ce qui rendra une courbe de trésorerie possible sans migration.
--
-- Idempotent (ON CONFLICT sur la PK). À appliquer manuellement dans le dashboard
-- Supabase AVANT `fetch_financials.py`.

create table if not exists company_financials (
  ticker            text        not null references asset(ticker),
  as_of_date        date        not null,   -- date de clôture du bilan lu
  cash              bigint      not null,
  invest_current    bigint,                 -- placements courants (null = aucun tag déclaré)
  invest_noncurrent bigint,                 -- placements NON courants — le poste qui manquait
  liquidity         bigint      not null,   -- ressources liquides TOTALES = somme des trois
  burn_per_quarter  bigint,                 -- flux d'exploitation ramené au trimestre (négatif = consommation)
  period_start      date,                   -- période RÉELLE du flux publié, affichée telle quelle
  period_end        date,
  period_days       integer,
  source_form       text        not null,   -- 10-Q, 10-K, 20-F, 6-K, F-1…
  source_filed      date        not null,
  source_url        text        not null,   -- lien canonique vers le dépôt — règle de la maison
  concepts          jsonb       not null,   -- tags XBRL retenus par seau : dossier d'audit
  crosscheck_value  bigint,                 -- chiffre du communiqué (null = non recoupé)
  crosscheck_source text,
  updated_at        timestamptz not null default now(),
  primary key (ticker, as_of_date)
);

comment on table company_financials is
  'C7 — ressources liquides TOTALES (trésorerie + placements courants ET non courants) et consommation, lues dans les dépôts SEC. Le runway n''est PAS stocké : il se recalcule à la lecture.';

comment on column company_financials.invest_noncurrent is
  'Placements non courants. Les omettre donnait 27,8 M$ à RGTI au lieu de 541,3 M$ et un runway de 2 trimestres à une société sans dette : c''est la colonne qui a motivé cette table.';

-- Dépôts déclarés (S-3, F-3, 424B5…) — signaux FACTUELS de financement potentiel.
-- Nommés par leur forme exacte, jamais qualifiés d'« ATM » ni agrégés en score :
-- règle §10 de la bible éditoriale, information et non recommandation.
create table if not exists company_filing (
  ticker    text not null references asset(ticker),
  accession text not null,
  form      text not null,
  filed     date not null,
  url       text not null,
  primary key (ticker, accession)
);

comment on table company_filing is
  'C7 — dépôts déclarés (shelf / prospectus). Faits datés et sourcés uniquement : aucun score, aucun classement « risque de dilution ».';

-- Contrôle après application :
--   select ticker, as_of_date, liquidity, burn_per_quarter, source_form, crosscheck_value
--   from company_financials order by ticker;
--   select ticker, count(*) from company_filing group by ticker order by ticker;
