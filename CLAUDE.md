# The Quantum Wall — L'Investisseuse Quantique

**The Quantum Wall** est le nom officiel du produit. L'éditeur est la chaîne **L'Investisseuse Quantique**.
Ces deux entités sont distinctes : le produit peut évoluer de nom ou de périmètre indépendamment de la marque.

Dashboard public de suivi de portefeuilles quantiques fictifs (benchmarks pédagogiques
issus de la vidéo #33 « Investir dans le quantique en 2026 »). Langue par défaut : **français**.

## Vision produit & contraintes d'architecture long terme

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

**Étalon de marché** (graphique comparatif accueil uniquement) : **QQQ** — Invesco Nasdaq-100 ETF
(NASDAQ, USD). Série gris clair (`#CBD5E1`), pointillé fin, base 100 depuis l'inception.
**Ne jamais inclure QQQ dans les portefeuilles, les snapshots, ni les agrégats sectoriels futurs.**
C'est une référence de marché d'affichage uniquement — en base : `asset.category = 'etf'`.

## Univers sectoriel (suivi market cap — 9 sociétés)

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

**NVDA (infrastructure)** : dans les portefeuilles, pas dans l'univers sectoriel pure-player.

**Note QNT — structure double classe :**
Quantinuum est cotée en Nasdaq depuis le 04/06/2026. Structure : Class A (flottant public ~28 M actions)
+ Class B détenue par Honeywell (contrôle majoritaire). yfinance retourne probablement seulement le
flottant Class A → market cap massivement sous-estimée. Après vérification dans le prospectus S-1/SEC,
surcharger manuellement dans `shares_outstanding` avec `source = 'SEC S-1 2026-06'` et le total Class A+B.
Le script `fetch_shares.py` affiche une alerte explicite et le SQL de surcharge à chaque exécution.

**Migration 005** (`supabase/migrations/005_add_sectoral_tickers.sql`) : ajoute QNT, RGTI, QUBT dans
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

**État actuel (2026-06-17) : V1.5 implémentée + S1 Étape A (market cap) + univers sectoriel étendu à 9 sociétés (QNT/RGTI/QUBT). Date d'inception définitive : `2026-06-01`.**

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

### S2 — Variations multi-horizons (fondation de données #2)

**Ce qui est construit :** enrichissement de l'ingestion quotidienne pour calculer et stocker
`change_1d`, `change_1w`, `change_1m`, `change_ytd`, `change_1y` dans une table
`price_change` (ticker, date, …). Tout est dérivé de `price_daily` déjà en base —
aucun appel réseau supplémentaire. Idempotent (upsert).

**Dépendances :** S1 non requise. Réutilise `price_daily` à 100 %.

**Schéma :**
```sql
create table price_change (
  ticker      text references asset(ticker),
  date        date not null,
  change_1d   numeric,   -- variation 1 jour
  change_1w   numeric,   -- variation 5 jours ouvrés
  change_1m   numeric,   -- variation ~21 jours ouvrés
  change_ytd  numeric,   -- depuis le 1er janvier
  change_1y   numeric,   -- 252 jours ouvrés
  primary key (ticker, date)
);
```

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
