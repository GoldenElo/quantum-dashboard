# The Quantum Wall — L'Investisseuse Quantique

**The Quantum Wall** est le nom officiel du produit. L'éditeur est la chaîne **L'Investisseuse Quantique**.
Ces deux entités sont distinctes : le produit peut évoluer de nom ou de périmètre indépendamment de la marque.

Dashboard public de suivi de portefeuilles quantiques fictifs (benchmarks pédagogiques
issus de la vidéo #33 « Investir dans le quantique en 2026 »). Langue par défaut : **français**.

## Vision produit & contraintes d'architecture long terme

> **OBJECTIF STRATÉGIQUE — cession du média à horizon 3 ans (2029).**
> Toute décision produit se juge à l'aune de la **thèse d'acquisition** :
> - **audience mesurée et possédée** (analytics, liste d'emails) ;
> - **IP démontrable** — indice propriétaire, historique accumulé, base d'événements, curation éditoriale ;
> - **marque autonome** — The Quantum Wall existe indépendamment de la chaîne ;
> - **due diligence propre** — licence de données, tests des calculs critiques, exportabilité,
>   doctrine d'indépendance (§18 de la bible éditoriale).
>
> Une feature qui ne renforce aucun de ces axes n'a pas de priorité. Ce qui n'est pas cessible
> n'est pas un actif.

Ces contraintes s'appliquent **dès maintenant** à chaque ligne de code écrite.
Ce ne sont pas des features à implémenter plus tard — ce sont des rails à ne jamais enfreindre.
Principe directeur : **prévoir la place sans construire prématurément** — l'architecture
ne doit jamais s'opposer à ces ajouts, mais on n'écrit pas de code mort en attendant.

### 1. Nom du produit

Le produit s'appelle **The Quantum Wall**. L'éditeur est **L'Investisseuse Quantique**.
- Utiliser "The Quantum Wall" dans les métadonnées (`<title>`, `og:site_name`), les mentions légales
  et les communications produit.
- Utiliser "L'Investisseuse Quantique" pour la signature éditoriale, le footer et le branding chaîne.
- Ne jamais mélanger les deux dans le même contexte sémantique.

### 2. Monétisation freemium (fondation posée, paliers à venir)

**Ne rien implémenter du paiement maintenant.** Mais chaque décision d'architecture doit rendre
l'ajout de paliers possible sans refonte.

- **Niveaux d'accès** : `public` → `free_authenticated` → `paid` (noms définitifs à figer lors
  de l'implémentation). L'auth Supabase déjà en place (session serveur, `@supabase/ssr`) est
  la fondation — les paliers supérieurs s'y greffent via un champ `plan` sur le profil utilisateur.
- **Règle de codage** : toute page ou route API qui retourne des données doit pouvoir recevoir
  un paramètre de niveau d'accès requis sans restructuration. Privilégier les Server Components
  qui lisent la session et décident du contenu rendu — c'est déjà le pattern en place pour le perso.
- **Ce qu'on ne fait pas** : aucune table `subscription`, aucun webhook Stripe, aucune logique
  de paiement dans le code tant que le modèle commercial n'est pas arrêté.

### 3. Emplacements publicitaires (slots)

Des slots publicitaires sont réservés structurellement dans le layout — vides aujourd'hui,
pour ne pas redécouper les pages lors de l'activation.

**Emplacements prévus (vides, sans markup publicitaire) :**
- Sous le `<SiteHeader>`, avant le `<main>` : slot horizontal (`ad-slot-top`)
- Entre la section des cartes et le graphique comparatif (homepage) : slot inline (`ad-slot-mid`)
- En bas de chaque page détail, avant le footer : slot horizontal (`ad-slot-bottom`)

**Règle de codage** : les slots sont des `<div className="ad-slot ad-slot-{id}" aria-hidden="true" />`
vides, sans texte ni image. Leur présence dans le DOM n'affecte pas le layout (hauteur 0 quand vides).
Ne jamais mettre de vrai contenu publicitaire sans accord éditorial explicite.

### 4. Internationalisation (i18n) — règle dure dès maintenant

**Aucun texte d'interface en dur dans le code à partir de la prochaine feature.**
Tout libellé visible par l'utilisateur passe par un système de traduction.
Le français est la langue par défaut. L'anglais sera ajouté en remplissant un fichier de
traductions — sans toucher au code des composants.

**Ossature à mettre en place dès la prochaine évolution :**
- Un fichier `src/i18n/fr.ts` contenant tous les libellés français sous forme de clés typées.
- Un hook/helper `t(key)` utilisé dans les composants à la place des strings littérales.
- Les nouvelles features naissent directement avec leurs libellés dans `fr.ts` — aucune exception.
- Les libellés existants (V1/V1.5) sont migrés au fil des modifications, pas en une seule passe.

**Ce qu'on ne fait pas maintenant** : aucune lib i18n externe (next-intl, i18next…), aucun routing
`/fr/` ou `/en/` — juste le fichier de traductions et le helper. La lib et le routing arrivent
quand la deuxième langue est prête.

**Règle de revue** : tout PR qui introduit un string littéral d'interface sans passer par `t()`
est refusé à partir de la première feature post-V1.5.

---

## Règles non négociables

- Portefeuilles **fictifs, buy & hold, sans rebalancement**. Aucune transaction après l'inception.
- Disclaimer affiché en permanence (footer de toutes les pages + en-tête des pages de détail) :
  « **À titre informatif uniquement. Ceci n'est pas un conseil en investissement.**
  Portefeuilles fictifs à but pédagogique. Données de clôture à J-1, sans garantie d'exactitude. »
- Aucune donnée temps réel. Tout est pré-calculé en base par le cron ; le front ne calcule rien
  et n'appelle jamais l'API de marché.
- Devise d'affichage : **USD**. Tout est nativement en dollars, aucune conversion de devise.
- Toujours utiliser `adj_close` (ajusté splits/dividendes), jamais le close brut.

## Stack

- **Next.js (App Router, TypeScript)** déployé sur **Netlify** (repo Git déjà connecté).
  Domaine officiel : **thequantumwall.com** (constante `SITE_URL` dans `src/app/layout.tsx`).
  L'ancien `quantum-wall.netlify.app` redirige en **301** vers le domaine officiel.
- **Supabase** (Postgres) — accès serveur uniquement, clé service en variable d'env Netlify.
- **GitHub Actions** : cron d'ingestion du lundi au vendredi à 22h30 UTC (après clôture US),
  relançable manuellement (`workflow_dispatch`). Doit être **idempotent** (upsert partout).
- **Recharts** pour les graphiques. Charte : style Grafana sombre — voir section "Charte graphique" ci-dessous.
- **Polices** : IBM Plex Sans (titres `--font-heading`), Inter (corps `--font-body`),
  JetBrains Mono (tous les chiffres : valeurs, perfs, dates, axes, tooltips `--font-mono`).
  Playfair Display et DM Sans sont supprimés.
- Données marché : **Yahoo Finance** via `yfinance` (Python) en V1 ; migration vers Twelve Data
  prévue en V2. ⚠️ Vérifier au backfill que INFQ (NYSE depuis le 17/02/2026) est couvert ;
  sinon le signaler avant de coder un contournement.
- Cache : pages en ISR, revalidation 24 h (les données ne changent qu'une fois par jour).

## Ingestion (Python / GitHub Actions)

Les scripts de backfill et d'ingestion quotidienne sont en **Python** (`scripts/`),
indépendants de l'app Next.js. GitHub Actions les exécute directement.

- **Isolation du fournisseur** : tout appel `yfinance` est encapsulé dans un seul module
  (`scripts/market_data.py`). En V2, seul ce fichier change pour passer à Twelve Data.
- **Résilience** : yfinance est non officiel (scraping Yahoo). Le cron doit :
  - réessayer chaque ticker en cas d'échec réseau (3 tentatives, backoff exponentiel) ;
  - envoyer une alerte (GitHub Actions notice / email) si un ticker échoue après les réessais ;
  - **ne jamais écrire un snapshot partiel** — upsert atomique ou rollback complet pour la journée.

### Cron trimestriel des fondamentaux (`fetch_fundamentals.yml`)

Rafraîchit **shares_outstanding** (actions) et **revenue_ttm** (chiffre d'affaires TTM),
données trimestrielles distinctes du cron quotidien des prix. Lance `fetch_shares.py`
puis `fetch_revenue.py`. Idempotent (upsert), échoue proprement (annotation `::error::`).

- **Cadence** : `cron '0 6 1 2,5,8,11 *'` — le 1er de février / mai / août / novembre à 06h00 UTC,
  après la saison des résultats du trimestre précédent. Relançable via `workflow_dispatch`.
- **RÈGLE D'OR — non-écrasement des surcharges manuelles** : une ligne dont la `source`
  commence par `'SEC'` ou `'annual-report'` est **sanctuarisée**. yfinance ne met à jour
  que les lignes `source = 'yfinance'`. Implémenté dans `scripts/guards.py` (`is_manual_source`)
  et appliqué par les deux scripts (filtre sur la PK `(ticker, as_of_date)` avant upsert).
  Exemple protégé : la surcharge QNT en Up-C (322 M actions pleinement diluées).
- **Alertes CI** (`::warning::` dans les logs GitHub — à vérifier d'un coup d'œil sur SEC.gov) :
  - **Actions — variation forte** : nb d'actions yfinance varie de > ±15 % vs la valeur précédente
    (offering / dilution / split possible).
  - **Actions — contredit surcharge** : yfinance diverge de > ±15 % d'une surcharge SEC existante.
    Peut être **normal et permanent** (ex. QNT : yfinance ne voit que le flottant Class A ≈ 10 %
    du total Up-C → écart ~-90 % attendu à chaque exécution) ; sinon re-vérifier le dépôt SEC.
  - **CA — recoupement douteux** : écart `|Σ4T − rapporté| / rapporté` > 5 % (INFQ, QNT, XNDU
    au 2026-07-01) — confronter aux états financiers officiels.
  - **CA — contredit surcharge** : yfinance diverge de > ±15 % d'une surcharge SEC/annual-report.
  Les alertes **signalent sans masquer** — l'humain tranche et surcharge en base si besoin
  (`source = 'SEC 10-Q YYYY-MM-DD'` avec une `as_of_date` récente → prime via ORDER BY DESC).
- **Secrets GitHub requis** : `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` (identiques aux autres crons).

## Schéma SQL (Supabase)

```sql
create table asset (
  ticker text primary key,
  name text not null,
  category text not null check (category in ('geant','infrastructure','pure_player','etf')),
  exchange text not null,
  currency text not null default 'USD'
);

create table price_daily (
  ticker text references asset(ticker),
  date date not null,
  close numeric not null,
  adj_close numeric not null,
  volume bigint,
  primary key (ticker, date)
);

create table portfolio (
  id text primary key,         -- 'defensif' | 'dynamique' | 'agressif'
  name text not null,
  description text,
  inception_date date not null,
  initial_capital_usd numeric not null default 10000
);

create table position (
  portfolio_id text references portfolio(id),
  ticker text references asset(ticker),
  target_weight numeric not null,   -- poids à l'inception (ex. 0.40)
  quantity numeric not null,        -- figée à l'inception, fractionnaire autorisé
  primary key (portfolio_id, ticker)
);

create table snapshot_daily (
  portfolio_id text references portfolio(id),
  date date not null,
  value_usd numeric not null,
  perf_cumul numeric not null,      -- value/initial_capital - 1
  vol_30d numeric,                  -- annualisée, null si < 30 obs
  vol_90d numeric,
  max_drawdown numeric,
  primary key (portfolio_id, date)
);
```

## Les 3 portefeuilles (allocations officielles, figées)

Capital initial : **10 000 $ chacun**.
**Date d'inception : `[À RENSEIGNER — date de publication de la vidéo #33]`.**
Les quantités sont calculées une seule fois par le script de seed :
`quantity = (10000 × poids) / adj_close inception` — puis plus jamais modifiées.

| Ticker | Société | Catégorie | Défensif | Dynamique | Agressif |
|---|---|---|---|---|---|
| GOOGL | Alphabet | géant | 40 % | 30 % | 20 % |
| IBM | IBM | géant | 30 % | 20 % | 10 % |
| NVDA | Nvidia | infrastructure | 20 % | 20 % | 20 % |
| IONQ | IonQ | pure-player | 10 % | 12 % | 15 % |
| QBTS | D-Wave | pure-player | — | 9 % | 13 % |
| LAES | SEALSQ | pure-player | — | 9 % | 12 % |
| INFQ | Infleqtion | pure-player | — | — | 10 % |

Benchmark de comparaison affiché sur tous les graphiques : **QNTM.L** — VanEck Quantum Computing UCITS ETF
(LSE, devise USD, ticker yfinance validé, ISIN IE000S5XPDL3 env.). Remplace QTUM depuis la migration 002.
Chaque colonne doit sommer à 100 % — vérifier par un test.

**Étalon de marché** (graphique comparatif accueil uniquement) : **QQQ** — Invesco Nasdaq-100 ETF
(NASDAQ, USD). Série gris clair (`#CBD5E1`), pointillé fin, base 100 depuis l'inception.
**Ne jamais inclure QQQ dans les portefeuilles, les snapshots, ni les agrégats sectoriels futurs.**
C'est une référence de marché d'affichage uniquement — en base : `asset.category = 'etf'`.

## Univers sectoriel (suivi market cap — 12 sociétés)

Tickers suivis dans `price_daily` et `shares_outstanding` pour le tableau de market cap (S1/S4).
Distinct des portefeuilles : aucune de ces sociétés ne peut être ajoutée à un portefeuille après l'inception.

| Ticker | Société | Catégorie | Note |
|---|---|---|---|
| GOOGL | Alphabet | géant | aussi dans les 3 portefeuilles |
| IBM | IBM | géant | aussi dans les 3 portefeuilles |
| IONQ | IonQ | pure_player | aussi dans les 3 portefeuilles |
| QBTS | D-Wave | pure_player | aussi dans les 3 portefeuilles |
| LAES | SEALSQ | pure_player | aussi dans les 3 portefeuilles |
| INFQ | Infleqtion | pure_player | aussi dans le portefeuille agressif |
| RGTI | Rigetti Computing | pure_player | suivi sectoriel uniquement |
| QUBT | Quantum Computing Inc | pure_player | suivi sectoriel uniquement |
| QNT | Quantinuum | pure_player | **IPO 04/06/2026** — voir note ci-dessous |
| XNDU | Xanadu Quantum Technologies | pure_player | modalité PHOTONIQUE — IPO 27/03/2026 |
| ARQQ | Arqit Quantum | pure_player | ⚠ **quantum washing documenté** — voir note ci-dessous |
| HQ | Horizon Quantum Holdings | pure_player | fusion SPAC dMY Squared, cotation ~20/03/2026 |

**NVDA (infrastructure)** : dans les portefeuilles, pas dans l'univers sectoriel pure-player.

**Note QNT — structure double classe :**
Quantinuum est cotée en Nasdaq depuis le 04/06/2026. Structure : Class A (flottant public ~28 M actions)
+ Class B détenue par Honeywell (contrôle majoritaire). yfinance retourne probablement seulement le
flottant Class A → market cap massivement sous-estimée. Après vérification dans le prospectus S-1/SEC,
surcharger manuellement dans `shares_outstanding` avec `source = 'SEC S-1 2026-06'` et le total Class A+B.
Le script `fetch_shares.py` affiche une alerte explicite et le SQL de surcharge à chaque exécution.

**Note ARQQ — quantum washing :**
Arqit Quantum (ARQQ, Nasdaq NCM) est un cas documenté de quantum washing — la chaîne lui consacre
un épisode d'analyse. À NE PAS afficher comme équivalent aux autres pure-players sans la note
d'avertissement dédiée. Sur l'affichage frontend, ARQQ doit porter un marqueur visible
"profil à risque élevé — voir analyse" (note de bas de tableau, formulation neutre).
Le script `fetch_shares.py` affiche un avertissement `_CAUTION_NOTES` à chaque exécution.
Le chiffre d'actions (17,4 M, très bas) est à surveiller — vérifier dilutions sur SEC.gov.

**Migration 005** (`supabase/migrations/005_add_sectoral_tickers.sql`) : ajoute QNT, RGTI, QUBT dans
`asset` (idempotent — ON CONFLICT DO NOTHING). À appliquer avant tout backfill de ces tickers.

**Migration 006** (`supabase/migrations/006_add_xndu_arqq_hq.sql`) : ajoute XNDU, ARQQ, HQ dans
`asset` (idempotent — ON CONFLICT DO NOTHING). À appliquer avant tout backfill de ces tickers.

## Calculs (dans le cron, jamais dans le front)

- `value_usd` = Σ quantity × adj_close
- `perf_cumul` = value_usd / 10000 − 1
- Volatilité = écart-type des rendements quotidiens × √252, fenêtres glissantes 30 j et 90 j
- `max_drawdown` = creux maximal depuis le plus-haut historique du portefeuille
- Jours sans cotation (week-ends, fériés US) : aucun snapshot, aucune erreur, aucun doublon

## UI (V1) — public, sobre, sans surcharge

- **Page d'accueil** : 3 cartes compactes (nom du profil, valeur, perf depuis l'inception,
  vol 30 j) + une courbe comparative unique (3 profils + QNTM.L, base 100).
  **Aucun détail de composition sur l'accueil.**
- **Détail consultable sans alourdir** : chaque carte mène à `/portefeuille/[id]`
  (page dédiée, partageable, bonne pour le SEO) : camembert des poids actuels vs inception,
  tableau des lignes (ticker, quantité, valeur, contribution à la perf), courbe du profil vs QNTM.L,
  rappel du disclaimer en tête de page.
- Footer global : disclaimer + « Données : clôtures à J-1 » + signature
  « L'Investisseuse Quantique · Analyse · Chiffres · Sans hype ».
- Responsive mobile obligatoire (audience YouTube/X = majoritairement mobile).

## Phasage

- **V1 (fait)** : tout ce qui précède.
- **V1.5 (fait)** : portefeuille personnel implémenté — voir section "Données V1.5" ci-dessous.
- **V2+ (roadmap)** : voir section "Roadmap incrémentale" ci-dessous.

## Ordre de développement

1. ✅ Init Next.js + Supabase + schéma SQL + seed des 3 portefeuilles (quantités d'inception).
2. ✅ Script de backfill des prix depuis l'inception.
3. ✅ Cron GitHub Actions : ingestion quotidienne + calcul des snapshots (idempotent).
4. ✅ Pages : accueil puis `/portefeuille/[id]`, charte appliquée, disclaimer partout.
5. ✅ Déploiement Netlify + variables d'env + test du cron de bout en bout.
6. ✅ V1.5 : portefeuille personnel — migration 003, seed_personal.py, auth Supabase,
   page `/portefeuille/personnel` (force-dynamic), confidentialité stricte.
7. ✅ S1 Étape A : capitalisations boursières — migration 004 (shares_outstanding),
   fetch_shares.py, fetch_shares.yml (dispatch), log market caps dans ingest.py.
8. ✅ S1 + univers sectoriel : migration 005 (QNT, RGTI, QUBT dans asset),
   backfill étendu, TICKER_FIRST_TRADE pour QNT (IPO 04/06/2026), alerte double-classe.
9. ✅ S1 Étape C : tableau "Capitalisations du secteur" sur l'accueil — 9 sociétés triées
   par market cap, encart total pure-players, note QNT Up-C en footnote, détection
   données anciennes (LAES), disclaimer, i18n (src/i18n/fr.ts + t.ts).
10. ✅ Univers sectoriel élargi à 12 sociétés : migration 006 (XNDU, ARQQ, HQ dans asset),
    backfill étendu, _CAUTION_NOTES ARQQ dans fetch_shares.py.
    ✅ Affichage frontend XNDU/ARQQ/HQ validé (chiffres confirmés sur source primaire) :
    badge modalité (XNDU photonique), marqueur ARQQ † (reverse split / quantum washing).
11. ✅ S2 : variations multi-horizons des capitalisations sectorielles.
    - `scripts/backfill_sectoral.py` : backfill historique ~1 an (depuis **2025-06-01**) pour les
      12 tickers sectoriels UNIQUEMENT — **distinct de l'inception des portefeuilles (2026-06-01)**.
      Ne backfille NI NVDA NI les benchmarks (QNTM.L/QQQ) → courbes base 100 et étalon marché intacts.
      Les IPO récentes (QNT, XNDU, HQ, INFQ) ne renvoient que depuis leur 1re cotation (pas de fantôme).
    - **Garde-fou inception** dans `ingest.py` (`compute_snapshots`) : aucun snapshot avant
      `portfolio.inception_date`. Protège le portefeuille personnel (tickers tous sectoriels) contre
      des snapshots pré-inception générés depuis l'historique backfillé. Sans effet sur l'existant.
    - **Variations calculées à la volée** (api.ts) — jamais stockées : **table `price_change`
      abandonnée** (principe « ne jamais stocker le calculable » + cohérence market cap S1).
      Horizons en jours de COTATION : Jour (offset 1), Semaine (5), Mois (21), Année (252, calculée
      non affichée). `null` si historique insuffisant (IPO récente).
    - **Lecture paginée / bornée** : PostgREST plafonne toute réponse à 1000 lignes. `_load_prices`
      (ingest) pagine via `.range()` ; `api.ts` et `check_changes.py` lisent par ticker (fenêtre 260
      séances < 1000). Aucune troncature silencieuse possible quelle que soit la croissance de l'historique.
    - **Affichage** : 3 colonnes Jour/Semaine/Mois (vert/rouge foncé WCAG, « — » si null, mono),
      date du nb d'actions déplacée en infobulle sur la Capitalisation (fraîcheur conservée).
    - **Garde-fou d'alerte** : variation hebdo > ±150 % → marqueur ⚑ (côté contrôle `check_changes.py`
      ET côté lecteur, infobulle anti-hype « Variation exceptionnelle — forte volatilité, cotation
      récente (SPAC). À interpréter avec prudence. »). **Signale sans masquer** — l'humain tranche.

12. 🚧 S-P/S : ratio price-to-sales sectoriel (fondation de données #3).
    - **Migration 007** (`supabase/migrations/007_revenue_ttm.sql`) : table `revenue_ttm`
      (CA TTM par ticker, donnée externe comme `shares_outstanding`). Conserve les DEUX mesures
      du TTM — `revenue_reported` (totalRevenue) ET `revenue_sum_4q` (somme 4 trimestres) — pour
      le **recoupement anti-erreur**. `financial_currency` + `fx_rate` stockés (voir règle devise).
      **À appliquer manuellement dans le dashboard Supabase avant `fetch_revenue.py`.**
    - `market_data.fetch_revenue_ttm()` encapsule yfinance (totalRevenue + somme trimestres +
      `financialCurrency`) ; `market_data.fetch_fx_to_usd()` fournit le taux de clôture natif→USD.
    - `scripts/fetch_revenue.py` : persistance (upsert atomique, échec gracieux si migration absente).
    - `scripts/check_ps.py` : tableau de contrôle **lecture seule** — recoupement des deux mesures
      côte à côte sur chaque ligne + P/S. Ne stocke rien (recalcule depuis la source, comme
      `check_changes.py`).
    - **P/S calculé à la volée, jamais stocké** (principe « ne jamais stocker le calculable »,
      cohérent market cap S1 / variations S2). P/S = market_cap (USD) / CA (USD).
    - **RÈGLE DEVISE (dure) :** `totalRevenue` yfinance est dans la devise de reporting
      (`financialCurrency`), pas forcément en USD. Convertir le CA en USD (`revenue × fx_rate`)
      **avant** tout P/S — ne jamais mélanger market cap USD et CA en devise étrangère. Constat
      2026-07-01 : les 12 sociétés rapportent en USD (SEC foreign private issuers, y compris XNDU/CA,
      ARQQ/UK, LAES/CH, HQ/SG) → `fx_rate = 1.0`. La machinerie de conversion existe et est prouvée
      (CAD/GBP/CHF/EUR) pour absorber un futur ticker non-USD sans refonte.
    - **Recoupement STRICT à 5 %** : écart `|Σ4T − rapporté| / rapporté` > 5 % → marqueur ⚑.
      Au 2026-07-01 : INFQ (-19,6 %), QNT (+42,4 %), XNDU (-5,3 %, marginal) signalés.
    - **Affichage à deux niveaux (garde-fou anti-hype) :** P/S **ferme** uniquement si 4 trimestres
      cotés + devise convertie (GOOGL, IBM, IONQ, QBTS, RGTI, QUBT). Sinon marqueur distinct `‡`
      + infobulle (« estimation — CA partiel, société cotée depuis peu » / « CA non recoupé ») —
      **jamais un ratio ferme**. IPO récentes à TTM partiel : INFQ, QNT, HQ. CA quasi nul → `n.s.`
      (non significatif, ex. HQ). **Signale sans masquer** — l'humain tranche.
    - **⚠ LAES — vérification annuelle manuelle requise :** yfinance ne fournit pas le détail
      trimestriel de LAES (SEALSQ) → recoupement impossible, P/S non ferme (`‡`). Vérifier le CA
      dans le rapport annuel SEALSQ et surcharger `revenue_ttm` (source `annual-report`) le moment venu.
    - **ARQQ** conserve son avertissement quantum washing (recoupement également impossible via yfinance).

**État actuel (2026-07-01) : V1.5 + S1 (market cap, 12 sociétés sectorielles) + S2 (variations
multi-horizons) + S-P/S en cours (migration 007 + scripts revenue/P·S écrits, chiffres validés,
affichage frontend en attente de feu vert). Date d'inception portefeuilles : `2026-06-01`. Historique
sectoriel backfillé depuis `2025-06-01`.**

**Checklist de mise en service V1.5 (à faire manuellement) :**
1. Appliquer la migration `supabase/migrations/003_v1_5_personal_portfolio.sql` dans le dashboard Supabase.
2. Désactiver les inscriptions publiques : Supabase > Authentication > Settings > "Disable sign ups".
3. Récupérer la `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Supabase > Project Settings > API > anon public).
4. Ajouter `NEXT_PUBLIC_SUPABASE_URL` et `NEXT_PUBLIC_SUPABASE_ANON_KEY` dans les variables Netlify.
5. Exécuter `cd scripts && python seed_personal.py` (après migration + backfill déjà en base).
6. Exécuter `python ingest.py` pour générer les snapshots du portefeuille personnel.
7. Tester `/portefeuille/personnel` en public (pas de montant) puis connectée (montants visibles).

Tests minimum : poids = 100 % par profil, idempotence du cron (double exécution = même résultat),
calcul de volatilité vérifié contre un cas connu.

## Charte graphique (tokens CSS)

Style fond clair / presse financière — migré depuis l'ancienne charte bleu électrique (Grafana sombre) suite à l'évolution de l'identité de la chaîne.

| Token CSS | Valeur | Usage |
|---|---|---|
| `--bg-page` | `#ffffff` | Fond de page (blanc) |
| `--bg-panel` | `#f5f7fa` | Cartes, graphiques, tableaux (gris bleuté très clair) |
| `--border` | `#e6e9ee` | Bordures 1px, grille Recharts |
| `--accent-blue` | `#0d9488` | Teal foncé — accent principal, liens, actions |
| `--cyan` | `#34d1c4` | Teal vif — **aplats/badges uniquement**, jamais texte sur blanc |
| `--or` | `#b8943a` | Or foncé — chiffres-vedettes, signature, max 1 occurrence/vue |
| `--personal` | `#c2410c` | Orange brûlé — **RÉSERVÉ** portefeuille personnel, jamais ailleurs |
| `--text` | `#0c1d38` | Navy — texte principal |
| `--text-muted` | `#5a6b82` | Gris bleuté — texte secondaire, axes, légendes |
| `--positive` | `#15803d` | Vert foncé — hausse (WCAG AA 5.1:1 sur blanc) |
| `--negative` | `#dc2626` | Rouge — baisse (WCAG AA 4.8:1 sur blanc) |

**Règles dures :**
- Fond blanc — jamais de fond sombre ni de dégradé sur les pages et panneaux.
- Tout texte coloré utilise les versions **foncées** : teal `#0d9488`, or `#b8943a`. Ne jamais mettre de texte en teal vif `#34d1c4` (contraste insuffisant sur blanc).
- Les chiffres de perf sont toujours colorés (`--positive` / `--negative`), jamais gris.
- `--personal` (`#c2410c`) est **strictement réservé** au portefeuille personnel — jamais utilisé ailleurs.
- `--cyan` (`#34d1c4`) est **interdit pour tout texte** — réservé aux aplats pleins (badges, puces) où la surface suffit à la perception.
- Coins arrondis : 6px max. Pas d'ombres portées. Pas de dégradés décoratifs.
- En-têtes de panneau (`.section-title`, `.pie-title`) : petites capitales uppercase, 11-12px, `--text-muted`.

**Séries des graphiques :**

| Série | Couleur | Contraste/blanc | Style |
|---|---|---|---|
| Défensif | `#2563EB` | 4.5:1 ✓ AA | Plein, 2px |
| Dynamique | `#0d9488` | 3.7:1 ✓ (non-texte) | Plein, 2px |
| Agressif | `#7C3AED` | 5.6:1 ✓ AA | Plein, 2px |
| VanEck UCITS (QNTM.L) | `#5a6b82` | 5.5:1 ✓ AA | Pointillé, 1.5px |
| Nasdaq-100 (QQQ) | `#8099B3` | 3.5:1 ✓ (non-texte, secondaire) | Pointillé fin, 1.5px — étalon marché accueil uniquement |
| Portefeuille personnel | `#c2410c` | 5.1:1 ✓ AA | Plein, 2.5px — couleur réservée (`--personal`) |

## Données V1.5 — Portefeuille personnel (ne pas implémenter avant la V1.5)

### Positions (toutes en USD)

| Ticker | Enveloppe | Quantité | PRU (USD) | Note |
|---|---|---|---|---|
| IONQ | CTO | 179 | 25,54 | |
| QBTS | CTO | 160 | 11,90 | |
| IBM | CTO | 11 | 172,00 | |
| LAES | CTO | 669 | 2,36 | |
| GOOGL | CTO | 7 | 301,08 | |
| GOOGL | PER | 19,7722 | 228,45 | PRU reconstitué (coût = valeur − PV antérieure) |

Devise confirmée : **USD** pour tous les PRU.

### Décisions actées

- **Date de référence** : suivi de la performance depuis une date d'intégration à définir
  (la PV antérieure à cette date est contexte statique, non suivie).
- **Comparaison** : perf du portefeuille personnel vs benchmarks uniquement depuis la date d'intégration.
- **GOOGL consolidé** : CTO + PER agrégés à l'affichage (poids % total), avec détail par enveloppe
  accessible dans le tableau.
- **Visibilité publique** : base 100 et poids % uniquement — les montants (valeur, PRU, coût total)
  sont masqués en public et visibles uniquement après authentification (Supabase Auth).
- **Série graphique** : `#FF9830` (orange), couleur unique réservée à cette série dans toute l'UI.
- **Méthode de calcul** : TWR (Time-Weighted Return) pour la perf globale, MWR pour le rendement
  personnel. Les deux seront affichés.

## Roadmap incrémentale — vers le CoinMarketCap du quantique

**Cible finale :** un tableau de bord sectoriel de référence — classement vivant, mur de bulles,
agrégats pure-players, contrats et actualités — le tout cohérent et sans dette technique.

**Principe directeur :** chaque semaine construit sur la précédente.
Les fondations de données arrivent d'abord (S1–S2) ; l'affichage les consomme ensuite (S3–S4) ;
l'éditorial et les intégrations tierces viennent en dernier car ils ne bloquent rien.
Ne jamais stocker en base ce qui peut être calculé à la volée depuis `price_daily` ou `asset`.

---

### S1 — Capitalisations boursières (fondation de données #1)

**Ce qui est construit :** une table `shares_outstanding` (ticker, date, shares, source) peuplée
trimestriellement depuis les fiches SEC (Form 10-Q/10-K) pour les tickers US, et depuis les
rapports annuels pour LAES (SIX). Un script Python `scripts/fetch_shares.py` exécuté manuellement
ou via `workflow_dispatch` ; pas encore de cron automatique (les mises à jour sont trimestrielles).
`market_cap_usd = shares × adj_close` calculé à la volée côté API, jamais stocké.

**Dépendances :** aucune — fondation autonome. `asset.category` permet déjà le filtre pure-players.

**Schéma :**
```sql
create table shares_outstanding (
  ticker      text references asset(ticker),
  date        date not null,     -- date de publication du rapport
  shares      bigint not null,   -- nombre d'actions en circulation
  source      text not null,     -- 'SEC-10Q' | 'SEC-10K' | 'annual-report'
  primary key (ticker, date)
);
```

---

### S2 — Variations multi-horizons (fondation de données #2) — ✅ RÉALISÉE

**⚠️ Décision d'architecture (écart assumé vs le plan initial ci-dessous) :** la table `price_change`
**n'a PAS été créée**. Les variations sont **calculées à la volée** depuis `price_daily`, comme la
market cap S1 — conformément au principe directeur « ne jamais stocker en base ce qui peut être
calculé à la volée ». Aucune migration SQL pour S2.

**Ce qui est construit (réel) :**
- Backfill historique ~1 an `scripts/backfill_sectoral.py` (depuis **2025-06-01**, 12 tickers
  sectoriels uniquement — pas NVDA, pas les benchmarks). Distinct de l'inception portefeuilles.
- Variations à la volée dans `src/lib/api.ts` (`fetchMarketCapsData`) : horizons en **jours de
  cotation** — Jour (offset 1), Semaine (5), Mois (21), Année (252, calculée non affichée).
  `null` si historique insuffisant. Affichées : Jour / Semaine / Mois.
- **Lecture bornée par ticker** (fenêtre 260 séances) côté api.ts et `check_changes.py` ;
  `_load_prices` (ingest) paginé via `.range()` → contournement du plafond PostgREST (1000 lignes).
- Garde-fou inception dans `compute_snapshots` (ingest.py).
- Garde-fou d'alerte : variation hebdo > ±150 % → ⚑ (signale sans masquer), infobulle anti-hype.
- `scripts/check_changes.py` : tableau de contrôle des variations (lecture seule), réutilisable.

**Dépendances :** S1 non requise pour le calcul. Réutilise `price_daily` à 100 %.

**Plan initial (NON retenu — conservé pour mémoire) :** une table `price_change` stockée + calcul
dans le cron. Abandonné au profit du calcul à la volée (voir décision ci-dessus).

---

### S3 — Le Mur rouge/vert avec sélecteur d'horizon

**Ce qui est construit :** page `/mur` — grille de bulles SVG/D3 (ou Recharts Treemap en fallback).
Taille de chaque bulle = `market_cap_usd` (de S1). Couleur = variation selon l'horizon sélectionné
(de S2) : `--positive` si hausse, `--negative` si baisse, intensité proportionnelle.
Sélecteur d'horizon : 1J / 1S / 1M / YTD / 1A. ISR 24 h — données J-1, pas de temps réel.
Filtre par `asset.category` : tous / pure-players / géants / infrastructure / ETF.

**Dépendances :** S1 (tailles) + S2 (couleurs). Sans S1 les bulles ont toutes la même taille ;
livrer quand même une version dégradée si S1 est partielle.

**Note technique :** si D3 alourdit le bundle, démarrer avec Recharts `<Treemap>` et migrer en S7
quand le besoin visuel est confirmé. ⚠️ Avant mise en prod à fort trafic : vérifier la licence
yfinance (usage commercial) ou migrer vers Twelve Data.

---

## Phase Croissance — transformer le Wall en asset

**Principe directeur :** l'objectif n'est plus d'ajouter des features de données mais de construire
**trois actifs défendables** — l'historique accumulé, la couche de curation éditoriale, et une
audience mesurée/possédée. Chaque brique ci-dessous sert l'un de ces trois actifs ; une brique
qui n'y contribue pas n'a pas sa place dans cette phase. La séquence est **ordonnée** : la mesure
(C1) précède tout, car sans elle rien n'est vendable à un sponsor.

**Anti-objectifs explicites (garde-fous non négociables de la phase) :**
- **Pas de temps réel** — les données restent en J-1, cohérence avec la règle dure V1.
- **Pas de gamification** — aucun mécanisme de jeu, score utilisateur, badge ou classement social.
- **Pas d'accès payant avant une audience mesurée significative** — la séquence est **audience
  d'abord, monétisation ensuite**. Le paywall ne s'ouvre pas tant que C1 n'a pas prouvé l'audience.

### Piste Design (parallèle à la phase Croissance)

Une piste **Design** court en parallèle des briques C1–C6 : elle habille et fiabilise l'expérience
pendant que les actifs de données se construisent. Chaque étape D est calée sur un jalon C.

**Anti-objectif design (garde-fou dur) :** **jamais de dérive crypto-flashy** — pas de néons,
de dégradés animés, de tickers clignotants ni de hype visuelle. Le standard est **Bloomberg-lite** :
la **sobriété est le moat**. Toute proposition visuelle qui « fait crypto » est refusée d'office.

- **D1 — Identité produit (avant C1).** The Quantum Wall devient la **marque du site** : wordmark,
  header « édité par L'Investisseuse Quantique », favicon, meta / OG de base. Ajout d'un
  **horodatage visible « Données du [date], clôture US »** sur l'accueil. Pose la marque autonome
  exigée par la thèse d'acquisition — donc **avant** la mesure (C1).
- **D2 — Sparklines 7 jours (avec C2).** Mini-courbes 7 jours dans le tableau des capitalisations.
  Réutilise `price_daily` — **aucune nouvelle donnée**. Livré avec les fiches sociétés (C2).
- **D3 — Mode sombre.** Toggle clair / sombre — l'**infra de variables CSS existe déjà**
  (tokens de la charte graphique), le coût est faible.
- **D4 — Refonte mobile du tableau (bloquant avant toute campagne d'audience).** Colonnes
  essentielles + détail au tap, **remplace le swipe** actuel. **Prérequis dur** : ne lancer
  aucune campagne d'audience (C5, intégrations mi-vidéo) tant que l'expérience mobile du tableau
  n'est pas refaite — l'audience YouTube/X est majoritairement mobile.

### C1 — Mesure (prérequis de tout) — ✅ RÉALISÉE

**Ce qui est construit :** analytics respectueux de la vie privée (**Plausible** ou **Fathom**),
**sans cookie, sans bannière RGPD**. Objectifs de conversion basiques : clic vers YouTube,
futur signup newsletter (C5).

**Pourquoi en premier :** sans mesure, rien n'est vendable à un sponsor. C1 débloque la
justification commerciale de toutes les briques suivantes — c'est le prérequis dur de la phase.

**État réel (depuis le 2026-07-17) — Umami Cloud :**
- Outil retenu : **Umami Cloud** (cookieless, sans bannière RGPD — cohérent avec l'anti-objectif RGPD).
- Snippet intégré dans `src/app/layout.tsx` via `next/script` (`strategy="afterInteractive"`),
  chargé sur **toutes les pages** (App Router root layout).
- **Website ID** : `587d3c04-a8a9-4c31-b70e-18b37be6efe6` (domaine `thequantumwall.com`).
- **Événements personnalisés** (via `data-umami-event`) :
  - `clic-youtube` — lien YouTube du header (`src/components/SiteHeader.tsx`).
  - `clic-detail-portefeuille` — clic sur une carte portefeuille « Voir le détail »
    (`src/components/PortfolioCard.tsx`), avec propriété `data-umami-event-portefeuille`
    portant l'id du profil (defensif/dynamique/agressif/personnel).
- **RÈGLE DE CESSION (dure)** : **exporter les données Umami avant tout changement d'outil
  d'analytics**. La continuité de la courbe d'audience est un **actif du dossier de cession**
  (thèse d'acquisition — audience mesurée et possédée). Une rupture d'historique détruit
  la démonstration d'audience ; l'export préalable est non négociable.

### C2 — Fiches sociétés — ✅ RÉALISÉE (2026-07-17)

**Ce qui est construit :** pages `/societe/[ticker]` pour les **12 acteurs** du suivi sectoriel —
graphique de capitalisation historique, P/S dans le temps, variations multi-horizons, notes
éditoriales existantes (Up-C QNT, quantum washing ARQQ, flags ⚑/‡), et **méthodologie de la donnée**
affichée en clair. Réutilise **100 % des données déjà en base** — aucune nouvelle source.

**Objectif SEO :** capter la requête « nom d'entreprise + bourse / action » (cohérent avec la
Règle 1 §3 de la bible éditoriale, appliquée au site). Ces pages deviennent la **destination des
intégrations mi-vidéo** (§10) — le lien qu'on pose sous une vidéo pointe vers la fiche société.

**Dépendances :** S1 (market cap) + S2 (variations) + S-P/S (ratio). Aucune source externe nouvelle.

**État réel (implémentation) :**
- **Route** : `src/app/societe/[ticker]/page.tsx` (Server Component, ISR 24 h, `dynamicParams = false`
  → seuls les 12 tickers existent, tout autre renvoie un 404). URLs en **minuscules**
  (`/societe/ionq`). `generateStaticParams` alimenté par `listCompanyTickers()` (`api.ts`).
- **Données** : `fetchCompanyData(ticker)` (`api.ts`) — fonction dédiée qui **ne skip jamais** un
  ticker (une fiche rend toujours, chiffres « — » si donnée absente), et **réutilise les mêmes
  helpers** `computeChange` / `computePs` que le tableau → chiffres strictement identiques.
- **Courbe de capitalisation** (`CompanyCapChart` + `CompanyCapChartImpl`, pattern `dynamic(ssr:false)`
  comme DetailChart) : **step-function des actions** — à chaque date, cours × dernier nb d'actions
  connu (`as_of_date` ≤ date) ; à défaut d'historique d'actions, le nb courant est appliqué
  rétroactivement. **Approximation documentée en note de méthode** sous la courbe (i18n). Prête à
  refléter les révisions d'actions dès que C7 backfillera l'historique — aucune refonte.
- **Données manquantes / IPO récentes** : historique court → courbe sur les seules séances cotées,
  variations `null` → « — », mention **« depuis cotation »** quand l'offset annuel est incalculable.
  Fraîcheur du nb d'actions (`isStale` > 5 mois, ex. LAES) reprise du tableau.
- **Curation mise en avant** : bloc « Notes de la rédaction » (≠ footnote discrète) fusionnant
  `TICKER_NOTES` (QNT Up-C, ARQQ †) + note HQ volatilité (`t.mur.hqNote`).
- **Placeholders C6/C7** : sections « Événements » et « Dilution » visibles mais discrètes (titre +
  ligne « bientôt »), structure prête.
- **SEO** : `title: { absolute: 'Nom (TICKER) en bourse — capitalisation, valorisation, analyse |
  The Quantum Wall' }` (court-circuite le `titleTemplate` du layout), meta `description` dynamique
  par société (capi + P/S + variation), `alternates.canonical`, OG par société.
  `src/app/sitemap.ts` (accueil + 12 fiches + 3 portefeuilles fictifs ; `/portefeuille/personnel`
  **exclu**) et `src/app/robots.ts` (disallow `/connexion`, `/portefeuille/personnel`).
  `SITE_URL` / `YOUTUBE_URL` / `X_URL` centralisés dans `src/lib/site.ts`.
- **Navigation** : cellule « Société » du tableau des caps ET tuiles du Mur cliquables vers la fiche
  (affordance discrète, SVG `<a>` pour les tuiles). **Événement Umami `clic-fiche-societe`** avec
  `data-umami-event-ticker` (mesure des sociétés qui attirent — cf. [C1]).
- **Acquisition (conversion trafic froid)** : ligne « L'analyse en vidéo sur L'Investisseuse
  Quantique » en bas de chaque fiche (avant le disclaimer), lien chaîne + événement Umami
  **`clic-youtube-fiche`** (`data-umami-event-ticker`). Les fiches captent du trafic froid → point
  de conversion vers la chaîne (actif d'audience de la thèse de cession).
- **Disclaimer** propre à la fiche (i18n, « ni conseil ni recommandation ») + horodatage
  « Données du [date], clôture US ». i18n intégral sous `t.societe.*` (`src/i18n/fr.ts`).

### C7 — Module Dilution

**Positionnement :** après C2 — le module vit **principalement sur les fiches sociétés**
(`/societe/[ticker]`), avec un complément possible dans le tableau des capitalisations.

**Ce qui est construit :**

1. **Nombre d'actions en circulation (existant, S1).** Afficher `shares_outstanding` avec **sa
   date et sa source** (`SEC-10Q` / `SEC-10K` / `annual-report` / surcharge `SEC ...`) sur les
   fiches sociétés et/ou le tableau. Réutilise la donnée S1 déjà en base — aucune nouvelle source.
   Respecte la RÈGLE D'OR de non-écrasement des surcharges manuelles (cf. cron trimestriel).

2. **Dilution historique mesurée.** Backfill des `shares_outstanding` **annuelles sur 5 ans**
   depuis les dépôts SEC (**10-K**, via l'**API EDGAR** + complément manuel là où EDGAR est
   lacunaire), **AJUSTÉES des splits / reverse splits** — piège documenté **Arqit (ARQQ) reverse
   split 25:1**, déjà signalé par le marqueur † et les `_CAUTION_NOTES`. À partir de la série
   ajustée, calculer le **taux de dilution annualisé**. IPO récentes (QNT, XNDU, HQ, INFQ) =
   mesure **« depuis cotation »**, jamais extrapolée avant la 1re cotation. **Chaque point
   historique est sourcé** (document SEC daté). Cohérent avec le principe « signale sans masquer,
   l'humain tranche » et « ne jamais stocker le calculable » (le taux se recalcule depuis la série).

3. **Signaux factuels de dilution future — JAMAIS de score prédictif.** Règle §10 de la bible
   éditoriale : **information, pas recommandation**. Présenter uniquement des **faits datés et
   sourcés**, sans agrégation en note ou probabilité :
   - **cash burn trimestriel** et **runway estimé** (depuis les états financiers) ;
   - **programmes ATM** (at-the-market) et **shelf registrations** déclarés (sourcés SEC).
   Aucun indicateur composite, aucun classement « risque de dilution » — ce serait une
   recommandation déguisée, interdite.

**Note éditoriale :** la dilution est **l'angle différenciant n°1 vs les agrégateurs grand public**
(Bloomberg, Morningstar n'exposent pas la dilution ajustée sourcée par acteur du quantique coté).
**Candidat fort pour une vidéo dédiée** à la sortie du module.

**Dépendances :** S1 (`shares_outstanding`) pour le point 1 ; C2 (fiches sociétés) comme support
d'affichage ; API EDGAR (SEC) + curation manuelle pour le backfill historique du point 2.

### C3 — Indice Quantique propriétaire (« Indice IQ »)

**Ce qui est construit :** un indice sectoriel propriétaire avec **méthodologie publiée** — univers,
pondération (par capi flottante ou totale — **à trancher**), règles d'inclusion / exclusion,
rebalancement trimestriel, date d'inception documentée. Calcul **quotidien dans l'ingestion**
(jamais dans le front), page dédiée avec courbe. **Document de méthodologie en PDF téléchargeable.**

**Pourquoi :** c'est la **propriété intellectuelle licenciable** du projet — modèle MarketVector.
L'indice, sa méthodologie et son historique constituent un actif cessible indépendamment du site.

**Dépendances :** S1 (pondération par capi) + historique `price_daily`. Calcul côté cron uniquement.

### C4 — Images OG auto-générées

**Ce qui est construit :** image de partage (Open Graph) **générée quotidiennement depuis la treemap**
(le Mur du jour), pour que tout lien partagé sur X montre **le Mur vivant** plutôt qu'une carte statique.

**Pourquoi :** boucle virale gratuite — chaque partage social affiche l'état du secteur du jour.

**Dépendances :** S3 (treemap du Mur) pour la source visuelle.

### C5 — Newsletter hebdomadaire auto-générée

**Ce qui est construit :** digest hebdomadaire **construit depuis les données** (mouvements de la
semaine, Mur, un événement commenté issu de C6), avec **capture d'email** sur le site.

**Pourquoi :** l'**audience possédée** (liste d'emails) est l'actif que les sponsors achètent —
distinct d'une audience empruntée à une plateforme tierce. C'est l'aboutissement de la séquence
« audience d'abord ».

**Dépendances :** C1 (objectif signup), C6 (événement commenté), données S1–S2 (mouvements).

### C6 — Base d'événements sectoriels (fil continu) — 🚧 DÉMARRÉE (2026-07-18)

**Ce qui est construit :** une table `sector_event` alimentée **manuellement au fil de la veille
éditoriale**. Démarre **tôt** dans la phase et se remplit **en permanence** — l'accumulation est le
mécanisme. Affichée sur les fiches sociétés (C2) sous forme de **frise chronologique**.

**Pourquoi :** dans 18 mois, c'est **la seule chronologie annotée du quantique coté en français** —
un **moat par accumulation** qu'aucun concurrent ne peut rattraper rétroactivement.

**Schéma réel (migration 008, ≠ le plan initial `events` ci-dessous — conservé pour mémoire) :**
```sql
create table sector_event (
  id            serial primary key,
  ticker        text references asset(ticker),   -- NULL = événement sectoriel GLOBAL
  event_date    date not null,
  type          text not null check (type in (   -- liste FERMÉE
                  'ipo','spac','reverse_split','dilution','contrat',
                  'resultats','acquisition','reglementaire','technologie','autre')),
  title         text not null,
  description   text,
  source_url    text not null,                    -- OBLIGATOIRE — règle de la maison
  source_label  text,
  created_at    timestamptz not null default now(),
  unique (ticker, event_date, title)              -- seed idempotent (on_conflict)
);
```

**RÈGLE DE LA MAISON (dure) :** `source_url` est **NOT NULL** — aucun événement sans lien vers une
source primaire. Garanti en base (contrainte) ET revérifié par `seed_events.py` (refus d'écriture
si un seul événement est invalide : source manquante, type hors liste, date non ISO — jamais d'état
partiel). `type` est une **liste fermée** (CHECK) ; les libellés vivent dans `t.evenements.types.*`.

**Saisie (pas d'interface d'admin — hors périmètre C6) :** SQL direct dans Supabase, ou
`scripts/seed_events.py` — liste Python `EVENTS` lisible/éditable, upsert idempotent
`on_conflict=(ticker,event_date,title)`. Une admin viendra plus tard ; en attendant, le script
est la voie d'entrée. Prérequis : **migration 008 appliquée manuellement**.

**Affichage :** `EventTimeline.tsx` (Server Component, pas de JS client) remplace le placeholder
« Événements » sur `/societe/[ticker]` : frise verticale des événements **du ticker** (event_date
DESC), badge type coloré discret (familles charte claire : or IPO/SPAC · teal contrat/résultats/
acquisition · rouge dilution/reverse_split · gris réglementaire/techno/autre), titre, description,
lien source « Source : [label] ↗ » (`data-umami-event="clic-source-evenement"` +
`data-umami-event-ticker`/`-type`). **0 événement → le placeholder « Bientôt » reste.**
Lecture repliée dans `fetchCompanyData` (api.ts), **fallback gracieux** si la table n'existe pas
encore (events=[]). Les **événements globaux (`ticker=null`) sont exclus des fiches** — réservés à
une future page secteur / la newsletter (C5). i18n intégral `t.evenements.*`. ISR 24 h inchangé.

**Mise en service (à faire manuellement) :** 1) appliquer `supabase/migrations/008_sector_events.sql`
dans le dashboard Supabase ; 2) `cd scripts && python3 seed_events.py` (seede les 7 premiers
événements réels). Tant que (1) n'est pas fait, toutes les fiches affichent « Bientôt » (fallback).

**Dépendances :** aucune (saisie manuelle) — démarre indépendamment, se déverse dans C2 et C5.

### Dettes d'architecture à traiter dans cette phase (exigences d'une due diligence)

Ces dettes ne sont pas optionnelles : elles conditionnent la **cessibilité** de l'actif.

- **(a) Licence de données — BLOQUANTE avant monétisation.** La migration `yfinance → Twelve Data`
  (ou équivalent avec **droit de redistribution**) devient un prérequis dur **avant toute
  monétisation ou tout trafic significatif**. yfinance (scraping non officiel) ne peut pas
  soutenir une exploitation commerciale.
- **(b) Tests automatisés sur les calculs critiques.** Couverture obligatoire des calculs
  perf, volatilité, P/S et **indice IQ (C3)** — la valeur de l'actif repose sur l'exactitude
  de ces chiffres.
- **(c) Exportabilité.** Schéma documenté, dump reproductible : **l'actif vendable est la base
  de données + la couche de curation, pas le front**. Toute décision de schéma doit préserver
  un export propre et autonome.

---

### S4 — Classement et agrégats sectoriels

**Ce qui est construit :** page `/secteur` avec :
- tableau classement par `market_cap_usd` décroissante (tous tickers + filtrable) ;
- encart "Pure-players quantiques" : market cap totale agrégée + variation moyenne pondérée ;
- colonne "Exposition quantique déclarée vs réelle" pour les ETF (QNTM.L et ajouts futurs) :
  poids quantum déclaré dans le prospectus vs poids effectif calculé depuis les holdings publics
  (donnée éditoriale, stockée dans `asset_meta`).

**Dépendances :** S1 (market cap) + S2 (variations). `asset.category` déjà en place pour les agrégats.

**Schéma additionnel :**
```sql
create table asset_meta (
  ticker              text primary key references asset(ticker),
  quantum_weight_pct  numeric,   -- exposition quantique déclarée (ETF)
  notes               text
);
```

---

### S5 — Suivi des contrats majeurs (éditorial)

**Ce qui est construit :** table `contract` (éditoriale, saisie manuelle) + section sur la page
`/secteur` ou dans les pages détail `/portefeuille/[id]` : liste des contrats publiés,
filtrables par ticker. Pas d'automatisation — source = annonces officielles + presse spécialisée.

**Dépendances :** aucune dépendance aux S1–S4. Peut être livré indépendamment,
mais positionné ici car S3–S4 saturent la valeur des deux premières semaines.

**Schéma :**
```sql
create table contract (
  id          serial primary key,
  ticker      text references asset(ticker),
  client      text not null,
  amount_usd  numeric,           -- null si non divulgué
  announced   date not null,
  source_url  text,
  notes       text
);
```

---

### S6 — Fil X @InvestQuantique

**Ce qui est construit :** intégration du fil X (Twitter) de la chaîne via l'API X v2
(bearer token) ou widget embarqué officiel. Affiché en sidebar ou en bas de l'accueil.
Cron de rafraîchissement toutes les heures (dans GitHub Actions ou Netlify Scheduled Function).
Cache ISR court (1 h) sur la section concernée uniquement.

**Dépendances :** aucune dépendance aux briques de données.
Positionné ici car les fonctionnalités d'analyse (S1–S4) ont plus de valeur perçue à livrer avant.

**Point d'attention :** l'API X v2 Basic tier est limitée à 500 000 tweets lus/mois —
suffisant pour un fil personnel faible volume. Surveiller le quota dès la mise en prod.

---

### S7 — Coin articles / news

**Ce qui est construit :** section éditoriale légère sur l'accueil ou page `/news` :
articles rédigés par la chaîne (Markdown stocké en base ou fichiers statiques MDX),
+ fil RSS optionnel de sources externes (IEEE Spectrum Quantum, The Quantum Insider).
Pas de LLM, pas de génération automatique — curation humaine uniquement.

**Dépendances :** aucune. Livré en dernier car il ne débloque aucune brique de données
et peut être alimenté progressivement après la mise en ligne des fonctionnalités S1–S6.

---

### Note infrastructure

- Migration Supabase → Netlify Database (Postgres/Neon) à réévaluer après S4 :
  Supabase fournit l'auth V1.5, la migration doit résoudre l'auth autrement.
- Licence de données commerciale requise avant tout fort trafic public sur le Mur (S3) :
  yfinance est non officiel, Twelve Data ou Refinitiv pour la V commerciale.

---

## S8 — Données publiques du secteur quantique (recensement puis intégration)

**Objectif :** exploiter les gisements de données publiques mondiales sur le quantique
d'un point de vue investisseur — contrats gouvernementaux, subventions de recherche,
standards de cryptographie, publications scientifiques, programmes nationaux.

**Méthode en deux temps, sans exception :**
1. **Recensement exhaustif et priorisé AVANT tout développement.** Chaque source candidate
   est évaluée sur les cinq critères ci-dessous et soumise à une requête de test réelle.
   Une source qui ne répond pas à la requête de test est écartée ou marquée "à réévaluer".
2. **Intégration feature par feature.** Une source = une feature livrable indépendante.
   Si le volume est élevé, étaler sur plusieurs sous-versions (S8a, S8b, …).
   Ne jamais bloquer une feature sur une source non encore testée.

**Critères de priorisation (à appliquer à chaque source) :**

| Critère | Description |
|---|---|
| **Fiabilité** | Source primaire officielle vs agrégateur vs scraping non officiel |
| **Accès** | API sans clé (idéal) / API avec clé / scraping HTML (risque de casse) |
| **Pertinence investisseur** | L'information change-t-elle l'analyse d'un titre ou du secteur ? |
| **Effort d'intégration** | Volume de données, format (JSON/XML/CSV/PDF), fréquence de mise à jour |
| **Différenciation éditoriale** | Cette donnée existe-t-elle déjà chez des concurrents grand public ? |

**Règle de la chaîne :** toute source doit être validée par une vraie requête (curl ou script)
avant d'entrer en développement. Le résultat de la requête de test est consigné dans ce fichier
lors du recensement. Afficher une source non testée est interdit.

---

### Sources candidates identifiées

#### USAspending.gov — contrats fédéraux US par société
- **Type :** API REST officielle, sans clé, données du gouvernement américain.
- **URL de base :** `https://api.usaspending.gov/api/v2/`
- **Pertinence :** contrats Defense/DOE/NSF attribués aux pure-players quantiques (IonQ, D-Wave, etc.).
  Candidat fort pour **remonter en S5** et remplacer le suivi de contrats manuel :
  les contrats fédéraux sont détectés automatiquement au lieu d'être saisis à la main.
- **Accès :** public, sans authentification, rate limit généreux.
- **Requête de test à valider :**
  ```bash
  curl "https://api.usaspending.gov/api/v2/search/spending_by_award/" \
    -H "Content-Type: application/json" \
    -d '{"filters":{"keywords":["quantum"],"award_type_codes":["A","B","C","D"]},"limit":5}'
  ```
- **Statut :** ⬜ non testé — à valider avant développement.

#### arXiv — preprints quantiques
- **Type :** API XML (Atom), sans clé.
- **URL de base :** `https://export.arxiv.org/api/query`
- **Pertinence :** signal précoce sur les avancées techniques ; pertinent pour l'angle éditorial
  (articles/news S7) mais faible valeur investisseur directe. Différenciation éditoriale élevée
  si filtré sur les tickers (ex. papiers co-signés par IonQ, IBM Quantum, etc.).
- **Accès :** public, sans authentification, 3 req/s max.
- **Requête de test à valider :**
  ```bash
  curl "https://export.arxiv.org/api/query?search_query=ti:quantum+computing&max_results=3&sortBy=submittedDate"
  ```
- **Statut :** ⬜ non testé — à valider avant développement.

#### NIST — cryptographie post-quantique (standards PQC)
- **Type :** pages statiques + publications PDF, pas d'API structurée.
- **URL de référence :** `https://csrc.nist.gov/projects/post-quantum-cryptography`
- **Pertinence :** contexte réglementaire important (FIPS 203/204/205 publiés en 2024) ;
  impacte les valorisations des pure-players crypto-quantique (LAES/SEALSQ).
  Donnée éditoriale plutôt que flux automatisable.
- **Accès :** scraping HTML ou curation manuelle — pas d'API.
- **Effort :** élevé pour automatiser, faible si curation manuelle dans `asset_meta` ou `contract`.
- **Statut :** ⬜ non testé — probablement curation manuelle plutôt qu'intégration automatique.

#### NSF Awards — subventions de recherche quantique US
- **Type :** API REST officielle, sans clé.
- **URL de base :** `https://api.nsf.gov/services/v1/awards.json`
- **Pertinence :** subventions NSF aux universités et entreprises sur le quantique ;
  indicateur de l'écosystème de recherche mais lien ténu avec les cours boursiers.
  Meilleure valeur pour l'angle "écosystème" que pour l'angle "investisseur direct".
- **Accès :** public, sans authentification.
- **Requête de test à valider :**
  ```bash
  curl "https://api.nsf.gov/services/v1/awards.json?keyword=quantum+computing&dateStart=01/01/2025&printFields=id,title,awardeeName,fundsObligatedAmt"
  ```
- **Statut :** ⬜ non testé — à valider avant développement.

#### DARPA Quantum Benchmarking Initiative (QBI) — classement des entreprises par stage
- **Type :** programme gouvernemental US — liste d'entreprises participantes et leur stade
  d'avancement publiée par DARPA via communiqués officiels et mises à jour de programme.
  Pas d'API connue ; format probable : page web DARPA + PDF + communiqués de presse.
- **URL de référence :** `https://www.darpa.mil/program/quantum-benchmarking-initiative`
  (à valider — DARPA restructure régulièrement ses URL de programme).
- **Pertinence investisseur : ÉLEVÉE — candidat éditorial fort.**
  Le QBI est une évaluation gouvernementale US indépendante de la crédibilité technique
  des acteurs du quantique : quelles entreprises sont jugées capables d'atteindre un
  calculateur utile, et à quel stade elles se situent (ex. Technical Performance Evaluation,
  Phase 1/2/3). Contrepoint factuel direct au quantum washing :
  - IonQ, D-Wave, IBM, et d'autres cotés directs du dashboard sont dans le périmètre QBI.
  - Un changement de stade = signal fort pour l'analyse sectorielle.
  - Différenciation éditoriale maximale : donnée absente de Bloomberg, Morningstar et
    des agrégateurs grand public.
- **Accès :** pas d'API — curation manuelle à partir des annonces DARPA officielles.
  Fréquence de mise à jour : basse (quelques fois par an, calée sur les jalons du programme).
- **Effort d'intégration :** faible en curation manuelle ; stockage dans `asset_meta`
  (champ `darpa_qbi_stage text`, `darpa_qbi_updated date`) ou dans une table dédiée si
  l'historique des stades est suivi.
- **Questions à résoudre lors du recensement :**
  - Vérifier que la liste complète des participants et leurs stades est publique (certaines
    phases QBI ont été confidentielles).
  - Identifier si DARPA publie un document structuré (PDF/tableau) ou seulement des
    communiqués textuels.
  - Confirmer quels tickers du dashboard sont présents dans le programme.
- **Statut :** ⬜ non testé — curation manuelle probable, pas d'automatisation à court terme.

#### Programmes nationaux non-US
Sources à évaluer après les sources US (fiabilité et accès plus variables) :

| Programme | Périmètre | Accès estimé | Pertinence investisseur | À évaluer |
|---|---|---|---|---|
| **EU Quantum Flagship** | Budget 1 Md€, projets financés | Site web + PDF, pas d'API connue | Moyenne — contexte réglementaire EU | Curation manuelle probable |
| **Plan quantique français** | 1,8 Md€, appels à projets ANR/BPI | Données ANR via data.gouv.fr (API possible) | Moyenne — peu de cotés directs | API data.gouv.fr à tester |
| **Programme quantique turc (TÜBİTAK)** | Budget et projets | Site en turc, accès incertain | Faible — aucun coté direct connu | Fiabilité à évaluer en priorité |

**Règle pour les programmes non-US :** ne pas afficher tant qu'une requête de test n'a pas
retourné des données structurées exploitables. Les PDF et pages HTML non structurées
sont classés "curation manuelle" et traités comme S5 (éditorial).

---

### Ordre d'intégration recommandé (à confirmer après test des requêtes)

1. **USAspending.gov** — remonter en S5 si le test valide la granularité par société.
   Effort faible, fiabilité maximale (source primaire fédérale), différenciation élevée.
2. **DARPA QBI** — curation manuelle dans `asset_meta`, dès que la liste des stades est
   vérifiée publique. Priorité éditoriale maximale même sans automatisation.
3. **NSF Awards** — S8a, après USAspending. Complète l'angle "contrats & subventions".
4. **arXiv** — S8b, intégré dans S7 (news/articles) comme flux de preprints filtrés.
5. **NIST PQC + programmes nationaux** — curation manuelle dans `asset_meta`, pas d'API.
