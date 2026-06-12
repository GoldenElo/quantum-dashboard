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

- **V1 (maintenant)** : tout ce qui précède.
- **V1.5** : portefeuille personnel — données et décisions actées ci-dessous, implémentation à venir.
  Ne rien anticiper dans le code V1 (pas de table `transaction`, pas de route dédiée).
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

## Charte graphique (tokens CSS)

Style Grafana sombre — identité visuelle YouTube de la chaîne.

| Token CSS | Valeur | Usage |
|---|---|---|
| `--bg-page` | `#060B1E` | Fond de page |
| `--bg-panel` | `#0D1530` | Cartes, graphiques, tableaux |
| `--border` | `#1E2B4D` | Bordures 1px partout |
| `--accent-blue` | `#2E7FE8` | Liens, actions, accents |
| `--cyan` | `#38BDF8` | Hover, surbrillances, ticker dans le tableau |
| `--text` | `#FFFFFF` | Texte principal |
| `--text-muted` | `#A9B8D4` | Texte secondaire — JAMAIS plus sombre |
| `--positive` | `#73BF69` | Hausse — toujours coloré, jamais gris |
| `--negative` | `#F2495C` | Baisse — toujours coloré, jamais gris |

**Règles dures :**
- Aucun texte plus sombre que `#A9B8D4` sur fond sombre.
- Les chiffres de perf sont toujours colorés (`--positive` / `--negative`), jamais gris.
- `#C9A84C` (or) est **supprimé** du projet — aucune occurrence autorisée.
- `#FF9830` (orange) est **strictement réservé** à la future série "portefeuille personnel" (V1.5).
  Ne jamais utiliser cette couleur ailleurs dans l'UI.
- Coins arrondis : 6px max. Pas d'ombres portées. Pas de dégradés décoratifs.
- En-têtes de panneau (`.section-title`, `.pie-title`) : petites capitales uppercase, 11-12px, `--text-muted`.

**Séries des graphiques :**

| Série | Couleur | Style |
|---|---|---|
| Défensif | `#5794F2` | Plein |
| Dynamique | `#38BDF8` | Plein |
| Agressif | `#B877D9` | Plein |
| VanEck UCITS (QNTM.L) | `#94A3B8` | Pointillé |
| Portefeuille personnel (V1.5) | `#FF9830` | Plein — couleur unique, réservée |

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

## Backlog / pistes futures

- Évaluer la migration de Supabase vers Netlify Database (Postgres/Neon) pour centraliser
  l'hébergement — point d'attention : Supabase fournit aussi l'auth du mode propriétaire prévu
  en V1.5, une migration devrait résoudre l'auth autrement. À réévaluer après la V1.5.
