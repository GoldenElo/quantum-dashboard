# Quantum Dashboard — L'Investisseuse Quantique

Dashboard **public** de suivi de 3 portefeuilles quantiques fictifs (benchmarks pédagogiques
issus de la vidéo #33 « Investir dans le quantique en 2026 »). Langue de l'interface : **français**.

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
- **Supabase** (Postgres) — accès serveur uniquement, clé service en variable d'env Netlify.
- **GitHub Actions** : cron d'ingestion du lundi au vendredi à 22h30 UTC (après clôture US),
  relançable manuellement (`workflow_dispatch`). Doit être **idempotent** (upsert partout).
- **Recharts** pour les graphiques. Charte : navy `#0a1628` / or `#c9a84c`,
  Playfair Display (titres), DM Sans (corps), JetBrains Mono (données chiffrées).
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

Benchmark de comparaison affiché sur tous les graphiques : **QTUM** (et lui seul en V1).
Chaque colonne doit sommer à 100 % — vérifier par un test.

## Calculs (dans le cron, jamais dans le front)

- `value_usd` = Σ quantity × adj_close
- `perf_cumul` = value_usd / 10000 − 1
- Volatilité = écart-type des rendements quotidiens × √252, fenêtres glissantes 30 j et 90 j
- `max_drawdown` = creux maximal depuis le plus-haut historique du portefeuille
- Jours sans cotation (week-ends, fériés US) : aucun snapshot, aucune erreur, aucun doublon

## UI (V1) — public, sobre, sans surcharge

- **Page d'accueil** : 3 cartes compactes (nom du profil, valeur, perf depuis l'inception,
  vol 30 j) + une courbe comparative unique (3 profils + QTUM, base 100).
  **Aucun détail de composition sur l'accueil.**
- **Détail consultable sans alourdir** : chaque carte mène à `/portefeuille/[id]`
  (page dédiée, partageable, bonne pour le SEO) : camembert des poids actuels vs inception,
  tableau des lignes (ticker, quantité, valeur, contribution à la perf), courbe du profil vs QTUM,
  rappel du disclaimer en tête de page.
- Footer global : disclaimer + « Données : clôtures à J-1 » + signature
  « L'Investisseuse Quantique · Analyse · Chiffres · Sans hype ».
- Responsive mobile obligatoire (audience YouTube/X = majoritairement mobile).

## Phasage

- **V1 (maintenant)** : tout ce qui précède.
- **V1.5** : portefeuille personnel (table `transaction`, TWR vs MWR) — ne rien anticiper en V1.
- **V2** : indicateurs sectoriels (market cap totale pure-players, P/S agrégé) —
  prévoir seulement que `asset.category` permet déjà l'agrégation.
- **V3** : « CoinMarketCap du quantique » + bubbles D3. ⚠️ Avant toute V3 publique à fort trafic :
  licence de données commerciale (le tier gratuit ne le permet pas).

## Ordre de développement

1. Init Next.js + Supabase + schéma SQL + seed des 3 portefeuilles (quantités d'inception).
2. Script de backfill des prix depuis l'inception.
3. Cron GitHub Actions : ingestion quotidienne + calcul des snapshots (idempotent).
4. Pages : accueil puis `/portefeuille/[id]`, charte appliquée, disclaimer partout.
5. Déploiement Netlify + variables d'env + test du cron de bout en bout.

Tests minimum : poids = 100 % par profil, idempotence du cron (double exécution = même résultat),
calcul de volatilité vérifié contre un cas connu.

## Backlog / pistes futures

- Évaluer la migration de Supabase vers Netlify Database (Postgres/Neon) pour centraliser
  l'hébergement — point d'attention : Supabase fournit aussi l'auth du mode propriétaire prévu
  en V1.5, une migration devrait résoudre l'auth autrement. À réévaluer après la V1.5.
