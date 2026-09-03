-- 016 — C7 : warrants, prix de référence, et distinction GAAP / non-cash
--
-- POURQUOI TROIS OBJETS D'UN COUP : ils répondent à la même question, posée par
-- deux dossiers simultanés (Pasqal cotée le 28/08/2026, IonQ et son T2 2026).
-- « Qu'est-ce qui peut diluer, et qu'est-ce qui a déjà été compté ? » Aucun de ces
-- chiffres ne se CALCULE : ils se LISENT dans un dépôt daté. Même nature que
-- `shares_outstanding`, `revenue_ttm`, `sector_event` et `company_financials` —
-- donnée externe, sourcée, dont l'accumulation est l'actif (dette (c),
-- exportabilité : ces chiffres doivent sortir dans le dump, pas rester en dur
-- dans le code du front).
--
-- RÈGLE DE LA MAISON, appliquée ici comme partout : la trilogie source_form /
-- source_filed / source_url est NOT NULL. Aucune ligne sans dépôt citable.
--
-- ⚠ RÈGLE §10 — AUCUN AGRÉGAT. Une ligne = un instrument. On ne stocke ni ne
-- calcule nulle part un « total de dilution potentielle » : additionner des
-- warrants dont les strikes vont de 11,50 $ à 155,00 $ reviendrait à supposer
-- qu'ils seront tous exercés, c'est-à-dire à publier une projection de cours
-- déguisée en fait. Chez IonQ, l'écart est de 1 à 13 : le total serait un chiffre
-- sans référent. Les lignes sont affichées côte à côte, jamais sommées.
--
-- Idempotent (create if not exists / add column if not exists). À appliquer
-- manuellement dans le dashboard Supabase AVANT `seed_warrants.py`.


-- ─── 1. Warrants ──────────────────────────────────────────────────────────────
-- Un instrument par ligne. La PK porte sur (ticker, series) et non sur une date :
-- un warrant est un instrument nommé, pas un relevé périodique. Sa quantité
-- diminue au fil des exercices — l'upsert met à jour la ligne, et la date de
-- mesure vit dans `as_of_date`.

create table if not exists company_warrant (
  ticker          text        not null references asset(ticker),
  series          text        not null,   -- 'public' | 'series_a' | 'series_b' | 'investment'…
  label           text        not null,   -- libellé affiché tel quel (ex. « Warrants publics (IONQ WS) »)
  shares_callable bigint,                 -- nb d'actions appelables ; NULL = non publié (affiché « — »)
  strike_usd      numeric     not null,   -- prix d'exercice
  as_of_date      date        not null,   -- date à laquelle shares_callable est mesuré
  expires_on      date,                   -- NULL = échéance non datée dans le dépôt
  issued_on       date,
  is_derived      boolean     not null default false,
  derivation_note text,                   -- OBLIGATOIRE si is_derived (contrainte ci-dessous)
  note            text,                   -- précision éditoriale sourcée (origine, conversion 1:1…)
  source_form     text        not null,   -- 20-F, 10-Q, 8-K, 424B5, communiqué…
  source_filed    date        not null,
  source_url      text        not null,
  updated_at      timestamptz not null default now(),
  primary key (ticker, series),
  constraint company_warrant_derived_note_check
    check (not is_derived or derivation_note is not null)
);

comment on table company_warrant is
  'C7 — warrants en circulation, un instrument par ligne. JAMAIS agrégés en « dilution potentielle » : additionner des strikes de 11,50 $ à 155,00 $ serait une projection, pas un fait (règle §10).';

comment on column company_warrant.shares_callable is
  'NULL = le dépôt ne publie pas le nombre. On affiche « — » plutôt qu''une estimation : un chiffre faux survit à la relecture, un chiffre absent non.';

comment on column company_warrant.is_derived is
  'true = le nombre n''est pas lu tel quel dans un dépôt mais reconstitué (ex. solde d''ouverture moins exercices du trimestre). derivation_note publie alors le calcul, à afficher au lecteur.';


-- ─── 2. Prix de référence ─────────────────────────────────────────────────────
-- POURQUOI PAS `price_daily` : cette table ne porte que close / adj_close / volume,
-- et le pipeline yfinance ne télécharge pas l'ouverture. Lui ajouter une colonne
-- `open` imposerait de modifier market_data.py, ingest.py et les trois backfills
-- pour un besoin ponctuel — et resterait vide en rétroactif. Un prix de référence
-- est ici une donnée ÉDITORIALE SOURCÉE (« voici où le titre a démarré »), pas une
-- série de marché : elle a un dépôt ou un relevé d'origine, comme tout le reste.
--
-- Cas d'usage : premier jour de cotation d'une ex-SPAC, où le seul repère de
-- valorisation qui vaille est le PRIX D'OPÉRATION (10,00 $ pour Pasqal), et non le
-- cours — d'où la colonne `reference_usd`, distincte des cours du jour.

create table if not exists company_reference_price (
  ticker        text        not null references asset(ticker),
  price_date    date        not null,
  kind          text        not null,   -- 'first_trading_day' | 'other'
  open_usd      numeric,
  high_usd      numeric,
  low_usd       numeric,
  close_usd     numeric,
  reference_usd numeric,                -- prix d'opération / d'offre — l'ancre de tout contrôle
  reference_note text,
  source_form   text        not null,
  source_filed  date        not null,
  source_url    text        not null,
  updated_at    timestamptz not null default now(),
  primary key (ticker, price_date)
);

comment on table company_reference_price is
  'C7 — prix de référence sourcés (premier jour de cotation…). Distinct de price_daily : donnée éditoriale datée, pas une série de marché ingérée.';

comment on column company_reference_price.reference_usd is
  'Prix d''OPÉRATION (SPAC / offre), pas le cours. C''est contre lui, jamais contre le cours, que se contrôle la cohérence d''un décompte d''actions post-fusion.';


-- ─── 3. GAAP vs non-cash ──────────────────────────────────────────────────────
-- Trois nombres qui sortent du MÊME dépôt que la ligne de liquidités déjà en base
-- (IonQ : 10-Q du 30/06/2026). Créer une table pour eux dupliquerait la trilogie
-- de source et la clé (ticker, as_of_date) sans rien apporter.
--
-- POURQUOI LES STOCKER : chez IonQ, la perte T2 2026 est de 1 867 742 k$ dont
-- 1 649 115 k$ de seule revalorisation du passif de warrants — une charge
-- comptable qui suit le cours de l'action et ne consomme aucune trésorerie.
-- Publier la perte GAAP sans cette décomposition donnerait à lire une hémorragie
-- de trésorerie là où le runway, lui, est intact. La distinction est PÉDAGOGIQUE
-- et FACTUELLE : on ne dit jamais que la perte « ne compte pas ».

alter table company_financials
  add column if not exists net_loss          bigint,   -- résultat net de la période (négatif = perte)
  add column if not exists warrant_fv_change bigint,   -- variation de juste valeur des warrants (négatif = charge)
  add column if not exists warrant_liability bigint;   -- passif de warrants au bilan, à as_of_date

comment on column company_financials.warrant_fv_change is
  'Variation de juste valeur du passif de warrants sur la période — SANS EFFET DE TRÉSORERIE. Chez IonQ au T2 2026 : 1 649 115 k$ sur une perte nette de 1 867 742 k$.';


-- Contrôle après application :
--   select ticker, series, label, shares_callable, strike_usd, expires_on, is_derived, source_form
--   from company_warrant order by ticker, strike_usd;
--   select ticker, price_date, kind, open_usd, close_usd, reference_usd
--   from company_reference_price order by ticker, price_date;
--   select ticker, as_of_date, net_loss, warrant_fv_change, warrant_liability
--   from company_financials where net_loss is not null order by ticker;
