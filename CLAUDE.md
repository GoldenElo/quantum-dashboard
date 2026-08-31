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
- **COROLLAIRE — non-coiffage des surcharges** (`_drop_superseding_yf`, fetch_shares.py) :
  sanctuariser la même PK ne suffit pas. La lecture côté API prend la ligne la plus récente
  (`ORDER BY as_of_date DESC`) : une ligne yfinance **datée plus tard** coifferait la surcharge
  sans jamais l'écraser, et la neutraliserait **en silence**. Ce n'est pas théorique — pour une
  société fraîchement cotée, yfinance n'expose pas de `mostRecentQuarter` et retombe sur **la date
  du jour**, donc sa valeur bat toujours toute surcharge. Constaté sur IQMX le 22/07/2026 :
  yfinance 211,0 M daté du jour passait devant la surcharge SEC 263,0 M du 16/07 → capitalisation
  minorée de 20 % alors que la surcharge était correctement en base. Règle : **toute ligne yfinance
  dont l'`as_of_date` ≥ celle d'une surcharge du même ticker n'est pas écrite** (alerte CI émise).
  Les lignes yfinance antérieures sont conservées — inoffensives et utiles à l'historique (C7).
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

## Maintenance planifiée (échéances datées)

Tâches à déclencher sur événement externe, pas sur une cadence. Une surcharge manuelle est un
**instantané** : elle ne vieillit pas toute seule, c'est à nous de la retirer quand la source
automatique redevient fiable. Une surcharge oubliée fige un chiffre périmé sans jamais alerter.

- **PSQL — décompte d'actions post-fusion : SURVEILLER CHAQUE 6-K, puis le 20-F.**
  **Échéance sur événement, pas sur date** : le premier dépôt de Pasqal Holding SA publiant le
  **capital social effectif** (nombre d'actions ordinaires en circulation après rachats) débloque
  d'un coup la **capitalisation**, le **P/S** et la **tuile du Mur**. Surveiller
  [EDGAR CIK 0002119292](https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=0002119292&type=6-K&dateb=&owner=include&count=40).
  Candidats : 6-K de résultats S1 2026, 6-K « total number of voting rights and shares », ou 20-F.
  **CONTRÔLE DE COHÉRENCE OBLIGATOIRE — contre le PRIX D'OPÉRATION de 10,00 $, JAMAIS le cours.**
  La valorisation annoncée (~2 Md$) est l'equity Pasqal au prix d'offre du SPAC : 200 000 000 ×
  10 $ = 2,000 Md$. Un décompte plausible doit donner `actions × 10 $ ≈ 2,1–2,4 Md$`. Rapporté au
  **cours**, le test échouerait sans que rien ne soit faux : le titre a clôturé à 19,11 $ le
  premier jour (+91 % sur le prix d'opération), soit une capi de marché ~2× la valo d'opération.
  Attendu dans **[209 583 333 ; 238 333 333]** — hors de cette fourchette, re-vérifier le dépôt
  avant d'écrire quoi que ce soit. Retirer alors la note `¶` et `t.secteur.capiIndisponible`.

- **IQMX — première publication de résultats (S1 2026, attendue ~août-septembre 2026).**
  Retirer la surcharge CA d'`_MANUAL_OVERRIDES` (`fetch_revenue.py`) **si et seulement si** les deux
  conditions sont réunies : (a) yfinance déclare enfin `financialCurrency`, et (b) 4 trimestres
  deviennent recoupables (`quarters_used = 4`). Sinon le CA reste **figé sur l'exercice clos au
  31/12/2025**, qui vieillit à chaque mois qui passe. Tant que la surcharge tient, le P/S doit
  rester marqué `‡`. Vérifier au passage si la surcharge **actions** (263 039 597 au 16/07/2026)
  doit être actualisée : tout exercice de warrants ou émission nouvelle est publié en « Total number
  of voting rights and shares » par le registre finlandais.
- **Indice TQW — rebalancement du 2026-08-03 (lundi).** Le cron du soir crée automatiquement le
  rebalancement et fait **entrer QNT** (30 séances franchies le ~17/07) → 10 constituants. Rien à
  faire à la main ; **vérifier** le lendemain avec `cd scripts && python3 check_index.py` que la
  continuité est nulle et que les 4 contrôles durs passent.
- **Indice TQW — rebalancement du 2026-11-02 (lundi). ⚠ DOUBLE ENTRÉE ATTENDUE : IQMX + PSQL.**
  **IQMX** (21 séances au 31/07/2026, donc insuffisant en août ; seuil de 30 franchi mi-août) et
  **PSQL** (cotée le 28/08/2026 → 30e séance vers la **mi-octobre 2026**) deviennent éligibles
  ensemble. L'indice passerait de 10 à **12 constituants**. Vérifier avec `check_index.py` que la
  section « HORS UNIVERS » les annonce bien éligibles avant l'échéance.
  ⚠ **PSQL n'entre que si une ligne `shares_outstanding` existe à cette date** : la pondération est
  par capitalisation totale, et `index_tqw.py` **exclut avec alerte** tout constituant sans actions
  connues. Si le décompte n'est toujours pas publié le 02/11, PSQL est écartée du rebalancement —
  comportement correct, à ne pas contourner par une valeur supposée.
- **QNT — à chaque cron trimestriel.** La surcharge Up-C (322 M actions) est contredite en
  permanence par yfinance (~31 M, flottant Class A seul) : l'alerte est **normale**. Ne l'aligner
  sur yfinance sous aucun prétexte — ce serait diviser la capitalisation par dix.

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
(LSE, devise USD, ticker yfinance validé, **ISIN IE0007Y8Y157** — confirmé sur le KIID officiel VanEck
le 2026-08-06). Remplace QTUM depuis la migration 002. ⚠ L'ISIN `IE000S5XPDL3`, porté ici jusqu'au
2026-08-06 avec la mention « env. », était **erroné** : ne pas le réintroduire. Un identifiant n'est
jamais approximatif — soit il est confirmé sur source primaire, soit il n'est pas écrit.
Chaque colonne doit sommer à 100 % — vérifier par un test.

**Étalon de marché** (graphique comparatif accueil uniquement) : **QQQ** — Invesco Nasdaq-100 ETF
(NASDAQ, USD). Série gris clair (`#CBD5E1`), pointillé fin, base 100 depuis l'inception.
**Ne jamais inclure QQQ dans les portefeuilles, les snapshots, ni les agrégats sectoriels futurs.**
C'est une référence de marché d'affichage uniquement — en base : `asset.category = 'etf'`.

## Univers sectoriel (suivi market cap — 14 sociétés)

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
| IQMX | IQM Quantum Computers | pure_player | modalité SUPRACONDUCTEUR — fusion SPAC RAAQ, cotation 02/07/2026 — voir note ci-dessous |
| PSQL | Pasqal | pure_player | modalité ATOMES NEUTRES — fusion SPAC Bleichroeder II, cotation 28/08/2026 — voir note ci-dessous |

**NVDA (infrastructure)** : dans les portefeuilles, pas dans l'univers sectoriel pure-player.

**Note QNT — structure double classe :**
Quantinuum est cotée en Nasdaq depuis le 04/06/2026. Structure : Class A (flottant public ~28 M actions)
+ Class B détenue par Honeywell (contrôle majoritaire). yfinance retourne probablement seulement le
flottant Class A → market cap massivement sous-estimée. Après vérification dans le prospectus S-1/SEC,
surcharger manuellement dans `shares_outstanding` avec `source = 'SEC S-1 2026-06'` et le total Class A+B.
Le script `fetch_shares.py` affiche une alerte explicite et le SQL de surcharge à chaque exécution.

**⚠ BASE DE MESURE (dure, fixée le 2026-08-11) — actions ÉCONOMIQUES outstanding, PAS fully-diluted.**
La market cap QNT se calcule sur les **actions économiques en circulation** (Class A + Common Units,
soit Class A + Class B, les Class B étant non-économiques et miroir 1:1 des Common Units de
Quantinuum Holdings) — **PAS sur le fully-diluted**. Le chiffre de **322 M** du 424B4 incluait la
**dilution potentielle** (instruments non encore convertis) : **ne pas y revenir.**
Valeur courante : **262 906 073 actions au 30/06/2026** (Class A 36 134 196 + Class B 226 771 877),
premier chiffre publié par la société — résultats Q2 2026 / 8-K du 11/08/2026,
`source = 'SEC 8-K 2026-08-11 (…)'`,
[communiqué](https://ir.quantinuum.com/news-releases/news-release-details/quantinuum-reports-second-quarter-2026-results).
La ligne 424B4 du 05/06 à 322 M **reste en base** (historique jamais supprimé, utile à la courbe de
capitalisation et à C7) ; elle est simplement **supersédée** par l'`as_of_date` plus récente.
Corollaire : l'écart yfinance ↔ surcharge passe de ~-90 % à **~-86 %** (flottant Class A ≈ 14 %) —
l'alerte « contredit surcharge » reste **normale et permanente**, ne jamais l'aligner sur yfinance.

**RÈGLE DURE — UNE SOCIÉTÉ COTÉE NE DISPARAÎT JAMAIS EN SILENCE (posée le 2026-08-31).**
`fetchMarketCapsData` (api.ts) faisait `continue` sur toute société sans ligne
`shares_outstanding` : elle sortait alors du tableau, du Mur, de l'agrégat pure-players et de
l'image OG **sans un mot**. Tant que chaque ticker avait ses actions en base, le défaut était
invisible ; PSQL l'a révélé. Désormais **seule l'absence totale de cours** exclut une ligne —
sans cours il n'y a rien à dire. Un décompte d'actions manquant donne une ligne rendue avec
capitalisation et P/S à « — », marqueur `¶` et note de méthode. Corollaires, tous à préserver :
`MarketCapRow.shares/shares_date/shares_source/market_cap_usd` sont **nullables** ; le tri place
les capitalisations inconnues en fin de liste (elles ne peuvent être ni classées, ni classées en
tête) ; l'agrégat pure-players **nomme les sociétés qu'il n'a pas pu compter**
(`pure_player_excluded`) au lieu de se présenter comme exhaustif ; la **treemap** les écarte du
dessin — une tuile EST une surface, aucune taille ne peut être choisie sans mentir sur l'ordre de
grandeur — mais les **nomme juste en dessous** ; l'image OG les compte dans le « + N autres
pure-players » pour que la troncature reste annoncée. `marketCapPresentation()` est la **source
unique** de cette décision (desktop et mobile), au même titre que `psPresentation`.

**Note ARQQ — quantum washing :**
Arqit Quantum (ARQQ, Nasdaq NCM) est un cas documenté de quantum washing — la chaîne lui consacre
un épisode d'analyse. À NE PAS afficher comme équivalent aux autres pure-players sans la note
d'avertissement dédiée. Sur l'affichage frontend, ARQQ doit porter un marqueur visible
"profil à risque élevé — voir analyse" (note de bas de tableau, formulation neutre).
Le script `fetch_shares.py` affiche un avertissement `_CAUTION_NOTES` à chaque exécution.
Le chiffre d'actions (17,4 M, très bas) est à surveiller — vérifier dilutions sur SEC.gov.

**Migration 005** (`supabase/migrations/005_add_sectoral_tickers.sql`) : ajoute QNT, RGTI, QUBT dans
`asset` (idempotent — ON CONFLICT DO NOTHING). À appliquer avant tout backfill de ces tickers.

**Note IQMX — quatre pièges documentés (société finlandaise, ex-SPAC) :**
IQM Quantum Computers Oyj (Espoo), première société européenne du quantique cotée sur une grande
place US. Quatre écarts vérifiés le 22/07/2026, tous traités — **ne jamais les « re-simplifier »** :
1. **Ticker.** `IQM` sur Yahoo est le **Franklin Intelligent Machines ETF**, pas la société.
   Le ticker correct est **`IQMX`** (Nasdaq Global Select). Titre coté = **ADS, ratio 1:1**.
2. **Historique fantôme.** yfinance sert sous `IQMX` l'historique du SPAC **RAAQ** depuis juin 2025
   (~10 $ = valeur de trust). Borné par `TICKER_FIRST_TRADE['IQMX'] = 2026-07-02` (ingest.py,
   backfill.py) et `SECTORAL_FIRST_TRADE` (backfill_sectoral.py, qui **filtre à l'écriture** car il
   remonte à 2025-06-01). Conséquence assumée : variations Mois/Année à `—` (on préfère l'absence au faux).
3. **Actions sous-estimées de 24,7 %.** yfinance : 210 988 684. Registre du commerce finlandais :
   **263 039 597 actions et votes au 16/07/2026** (6-K du 20/07). Surcharge sanctuarisée
   `SEC 6-K 2026-07-16`. L'alerte « contredit surcharge » se déclenchera **à chaque exécution** —
   c'est **normal et permanent**, comme pour QNT.
4. **Devise de reporting non déclarée.** `financialCurrency` est `None` alors que les comptes sont
   en **EUR**. Voir RÈGLE DEVISE durcie (§ S-P/S) — c'est ce ticker qui a motivé le durcissement.

**P/S IQMX non ferme (`‡`), durablement :** aucun détail trimestriel via yfinance (recoupement
impossible, comme LAES/ARQQ) **et** le seul CA disponible est celui de l'**exercice clos au
31/12/2025** (31,333 M€) — ce n'est pas un TTM. Marqueur `§` en note de tableau. Ne passer en ratio
ferme que le jour où 4 trimestres publiés sont recoupables.

**Migration 006** (`supabase/migrations/006_add_xndu_arqq_hq.sql`) : ajoute XNDU, ARQQ, HQ dans
`asset` (idempotent — ON CONFLICT DO NOTHING). À appliquer avant tout backfill de ces tickers.

**Note PSQL — deux pièges documentés (société française, ex-SPAC) :**
Pasqal Holding SA (Palaiseau), **deuxième** société européenne du quantique cotée sur une grande
place US après IQMX. Fusion SPAC avec **Bleichroeder Acquisition Corp. II** (Nasdaq : BBCQ)
approuvée le 25/08/2026, closing le 27/08, première cotation le **28/08/2026**. SEC CIK
**0002119292**. Émetteur privé étranger → dépôts **6-K / 20-F**, jamais 10-Q/10-K.
Titre coté = action ordinaire (par valeur 0,02 €), pas d'ADS. `PSQLW` (warrants) **hors périmètre**.
⚠ **NE JAMAIS ÉCRIRE « IPO »** : c'est une fusion SPAC, le 6-K de clôture est explicite.

1. **Historique fantôme** (identique à IQMX/RAAQ et HQ/dMY). yfinance sert sous `PSQL` les
   **149 séances du SPAC Bleichroeder** depuis le 28/01/2026 (~9,95 $ = valeur de trust).
   Borné par `TICKER_FIRST_TRADE['PSQL'] = 2026-08-28` (ingest.py, backfill.py,
   backfill_shares_history.py) et `SECTORAL_FIRST_TRADE` (backfill_sectoral.py, qui **filtre à
   l'écriture**). Vérifié au backfill du 31/08/2026 : **147 séances écartées**, base = 2 séances
   (28/08 et 31/08), la plus ancienne au 28/08. Conséquence assumée : Semaine/Mois/Année à `—`.

2. **⛔ LE NOMBRE D'ACTIONS yfinance EST UNE HYPOTHÈSE, PAS UN RELEVÉ — piège inédit.**
   yfinance retourne `sharesOutstanding = 209 583 333`. Ce chiffre est repris **tel quel du
   prospectus 424B3 du 05/08/2026**, où il désigne explicitement le **scénario de RACHAT MAXIMAL** :
   « *…issued and outstanding immediately after the consummation… will be (i) assuming a no
   redemption scenario, **238,333,333** and (ii) assuming a scenario of maximum redemptions…,
   **209,583,333*** ». Le nombre réel dépend des rachats effectifs et vit dans
   **[209 583 333 ; 238 333 333]** — amplitude **13,7 %**. **AUCUN document déposé ne le publie** :
   le 6-K de clôture ne contient aucun décompte, les 425 des 21/24/25-08 ne publient aucun résultat
   de rachat, et le XBRL du CIK ne contient que le namespace `ffd` (frais de dépôt).
   → **AUCUNE ligne `shares_outstanding` n'est écrite.** Capitalisation et P/S affichés « — »,
   marqueur `¶`, note de méthode. Écrire 209 583 333 publierait une capi **minorée de jusqu'à
   13,7 %** en la présentant comme sourcée — c'est la faute QNT à l'envers, et elle survivrait à
   la relecture. Ce n'est pas une donnée partielle, c'est une **hypothèse de prospectus**.

**P/S PSQL non ferme (`‡`) et non calculable pour l'instant :** CA surchargé à **16 468 000 EUR**,
exercice clos au 31/12/2025 (424B3 du 05/08/2026, MD&A « Total revenue € 16,468 » en milliers,
recoupé par « *Pasqal's revenue was €16.4 million for the year ended December 31, 2025* »).
`financialCurrency = None` et `totalRevenue = None` → `fetch_revenue.py` **refuse la ligne**
(RÈGLE DEVISE) et la surcharge prend le relais, comme IQMX. `quarters_used = 0` → statut
`unrecouped` → marqueur `‡`. Tant qu'il n'y a pas de capitalisation, le P/S reste « — » :
la surcharge prépare le **dénominateur**, pas le ratio.

**Liquidités PSQL — non publiables :** le communiqué de clôture annonce « *approximately
$360 million of cash available at closing* » (EX-99.1 du 6-K). Aucun bilan déposé, aucun XBRL →
le **contrôle croisé bloquant à ±10 %** de C7 est impossible → aucune ligne `company_financials`,
aucun runway. Conforme à la doctrine (pas d'ancre, pas de publication).

**Migration 014** (`supabase/migrations/014_add_psql.sql`) : ajoute PSQL dans `asset`
(idempotent — ON CONFLICT DO NOTHING). À appliquer avant tout backfill de ce ticker.

**Migration 009** (`supabase/migrations/009_add_iqmx.sql`) : ajoute IQMX dans `asset`
(idempotent — ON CONFLICT DO NOTHING). À appliquer avant tout backfill de ce ticker.

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
      13 tickers sectoriels UNIQUEMENT — **distinct de l'inception des portefeuilles (2026-06-01)**.
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
    - **RÈGLE DEVISE (dure, DURCIE le 2026-07-22) :** `totalRevenue` yfinance est dans la devise de
      reporting (`financialCurrency`), pas forcément en USD. Convertir le CA en USD
      (`revenue × fx_rate`) **avant** tout P/S — ne jamais mélanger market cap USD et CA en devise
      étrangère. Constat 2026-07-01 : les 12 sociétés d'alors rapportent en USD (SEC foreign private
      issuers, y compris XNDU/CA, ARQQ/UK, LAES/CH, HQ/SG) → `fx_rate = 1.0`. La machinerie de
      conversion existe et est prouvée (CAD/GBP/CHF/EUR).
      **AUCUNE DEVISE DEVINÉE — devise explicite ou refus.** Si `financialCurrency` est absent,
      `fetch_revenue.py` **refuse la ligne** (alerte CI explicite) au lieu de retomber sur USD.
      Un défaut à USD revient à *affirmer sans preuve* que le CA est en dollars : c'est produire un
      chiffre faux, pas une approximation. Le relais est une **surcharge manuelle sourcée**
      (`_MANUAL_OVERRIDES` dans `fetch_revenue.py`) portant une `financial_currency` explicite ;
      `fx_rate` y est recalculé au taux courant à chaque exécution, jamais figé en dur.
      **Origine du durcissement — IQMX** (2026-07-22) : `financialCurrency = None` alors que les
      comptes sont en EUR ; l'ancien défaut USD donnait un P/S de **100,3 au lieu de 87,9 (+14 %)**.
      Un P/S faux est pire qu'un P/S absent — il survit à la relecture. Vaut pour **tout futur
      ticker non-US**, pas seulement IQMX.
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

13. ✅ **C3 — Indice TQW** (2026-08-01) : indice propriétaire des pure-players, base 100 au
    01/06/2026, pondération par capi totale plafonnée à 25 %, rebalancement trimestriel, diviseur
    de continuité. Migration 010 (`index_daily` + `index_weights`), moteur `scripts/index_tqw.py`
    branché en étape 5 de `ingest.py`, backfill + tableau de contrôle, page `/indice` avec
    méthodologie publiée (`docs/methodologie-indice-tqw.fr.md`). **Voir la section C3 détaillée
    dans la Phase Croissance** pour les règles dures et le calendrier des rebalancements.

**Univers sectoriel porté à 14 sociétés le 2026-08-31 : ajout de PSQL (Pasqal Holding SA) —
migration 014, `TICKER_FIRST_TRADE`/`SECTORAL_FIRST_TRADE` contre l'historique fantôme Bleichroeder
(147 séances écartées), surcharge CA en EUR (16 468 000 €), AUCUNE ligne `shares_outstanding` (le
chiffre yfinance est une hypothèse de prospectus), événement C6 de cotation, entrée à l'indice
reportée au rebalancement du 02/11/2026 conjointement avec IQMX.**

**Univers sectoriel porté à 13 sociétés le 2026-07-22 : ajout d'IQMX (IQM Quantum Computers) —
migration 009, `TICKER_FIRST_TRADE`/`SECTORAL_FIRST_TRADE` contre l'historique fantôme RAAQ,
surcharges SEC actions + CA (EUR), RÈGLE DEVISE durcie, événement C6 de cotation.**

**État actuel (2026-08-01) : V1.5 + S1 (market cap, 13 sociétés sectorielles) + S2 (variations
multi-horizons) + S-P/S + C1 (Umami) + C2 (fiches sociétés) + C6 (base d'événements, en
alimentation) + **C3 (Indice TQW — migration 010, moteur, page `/indice`, méthodologie publiée)**.
Date d'inception portefeuilles ET de l'indice : `2026-06-01`. Historique sectoriel backfillé
depuis `2025-06-01`.**

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

Style fond clair / presse financière — migré depuis l'ancienne charte bleu électrique (Grafana sombre) suite à l'évolution de l'identité de la chaîne. **Déclinaison sombre depuis D3 (2026-08-15) — voir « Mode sombre » ci-dessous.**

> **⚠ SOURCE UNIQUE — `src/lib/theme.ts`, jamais `globals.css`.** Depuis D3, `globals.css`
> ne contient **aucune valeur de couleur** : le bloc `:root { --token: … }` est **généré**
> par `buildThemeCss()` et injecté par le layout. Raison : les graphiques (Recharts, treemap
> SVG) reçoivent leurs couleurs en props JavaScript et ne savent pas lire `var(--token)` —
> deux jeux de valeurs tenus à la main auraient divergé. Pour changer une couleur : éditer
> `theme.ts`. Dans le CSS on n'écrit que `var(--token)` et `color-mix(… var(--token) …)`,
> pour que toute teinte dérivée reste juste dans les deux modes.

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

Trois jetons complètent la liste depuis D3, pour les **aplats pleins** (pastilles de nav,
boutons PDF/connexion, segment actif du Mur) : `--accent-fill`, `--accent-fill-text`,
`--accent-fill-hover`. Ils existent parce que la relation s'**inverse** entre les modes —
en clair, texte blanc sur teal foncé ; en sombre, texte sombre sur teal clair. Un
`color: #ffffff` en dur sur un aplat aurait donné 1,6:1 en mode sombre. `--accent-blue-hover`
complète de même le survol des liens textuels (le `#0b7d73` en dur était illisible en sombre).

**Règles dures :**
- Charte claire = fond blanc, jamais de dégradé sur les pages et panneaux. Le mode sombre
  (D3) est une **déclinaison de jetons**, pas une seconde charte : aucune règle de composition,
  d'espacement ou de hiérarchie ne change entre les deux.
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

Les séries ne portent plus leur couleur dans le code appelant : un composant serveur passe une
**clé** (`SeriesKey`) et la couleur est résolue côté client selon le mode. Corollaire réglé au
passage : le graphique du portefeuille personnel utilisait `#FF9830`, en contradiction avec le
`--personal` `#c2410c` de la charte — il passe par la clé `personnel` comme les autres.

### Mode sombre (D3 — 2026-08-15)

« Terminal de marché » : fond bleu-gris profond, **jamais de noir pur** (le noir pur sur écran
OLED fait baver le texte clair et durcit inutilement le contraste).

| Token | Clair | Sombre | Contraste sombre / `#0e1420` |
|---|---|---|---|
| `--bg-page` | `#ffffff` | `#0e1420` | — |
| `--bg-panel` | `#f5f7fa` | `#161e2e` | — |
| `--border` | `#e6e9ee` | `#263145` | — |
| `--text` | `#0c1d38` | `#e8edf5` | 15,7:1 |
| `--text-muted` | `#5a6b82` | `#93a3ba` | 7,2:1 |
| `--accent-blue` | `#0d9488` | `#2dd4bf` | 9,9:1 |
| `--or` | `#b8943a` | `#d9b45c` | 9,3:1 |
| `--personal` | `#c2410c` | `#fb923c` | 8,1:1 |
| `--positive` | `#15803d` | `#34d399` | 9,6:1 |
| `--negative` | `#dc2626` | `#f87171` | 6,7:1 |
| Séries Défensif / Dynamique / Agressif | `#2563EB` / `#0d9488` / `#7C3AED` | `#60a5fa` / `#2dd4bf` / `#a78bfa` | ≥ 6,1:1 |

**RÈGLES DURES — ne jamais « re-simplifier » :**
- **La charte claire n'est pas réutilisable telle quelle.** Les tons foncés sont calibrés pour
  le blanc : `--or` `#b8943a` tombe à 2,3:1 sur `#0e1420`. **Chaque accent est éclairci et son
  contraste revérifié** — c'est le piège n°1 du lot, pas un détail de finition.
- **Aucune valeur de couleur en dur, nulle part.** Ni en CSS (`var(--token)` / `color-mix`),
  ni en JS (`SERIES_COLORS`, `CHART_CHROME`, `PIE_COLORS`, `TREEMAP` dans `theme.ts`). Une
  couleur écrite en dur est, par construction, fausse dans l'un des deux modes.
- **Pas de flash blanc.** `THEME_INIT_SCRIPT` et le `<style>` des jetons sont les **premiers
  enfants de `<body>`** et doivent le rester : descendus plus bas, la page peindrait en blanc
  avant de basculer. Priorité : choix manuel (`localStorage`) > `prefers-color-scheme`.
- **Treemap du Mur — extrémités PROFONDES en sombre** (`#a11d1d` / `#166534`), jamais vives.
  Avec des extrémités vives, la zone médiane de la rampe n'atteint 4,5:1 ni en texte clair ni
  en texte foncé : un dégradé joli et illisible. Pire point mesuré en sombre : 6,1:1.
- **Les images OG restent en charte CLAIRE**, dans les deux modes. Elles s'affichent sur les
  fonds variés des réseaux sociaux, où le blanc est le choix lisible — et une carte partagée
  n'a pas de « mode » (elle ne connaît pas les préférences de celui qui la voit).
- **Audit reproductible** : 92 contrôles de contraste (texte, aplats, badges teintés, séries,
  camemberts, rampe de treemap) — **mode sombre : 0 échec**. Les échecs restants sont tous
  antérieurs à D3 et propres à la charte claire (`--or` 2,9:1 et teal `#0d9488` 3,7:1 en texte
  sur blanc, blanc sur aplat teal 3,7:1). À traiter dans une passe « accessibilité charte
  claire » — **ne pas les corriger au fil de l'eau**, la charte claire est publiée.

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
- Backfill historique ~1 an `scripts/backfill_sectoral.py` (depuis **2025-06-01**, 13 tickers
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
- **D3 — Mode sombre.** ✅ **RÉALISÉE (2026-08-15).** Toggle clair / sombre dans le header
  (icône lune/soleil), choix persisté en `localStorage`, `prefers-color-scheme` par défaut —
  l'OS décide à la première visite, le choix manuel prime ensuite (et se propage entre onglets).
  Périmètre complet : toutes les pages, tous les composants, **y compris les graphiques
  Recharts, la treemap du Mur et les tableaux**. Palette sombre et règles dures : voir
  « Mode sombre (D3) » dans la Charte graphique. Fichiers : `src/lib/theme.ts` (source unique
  des couleurs, clair + sombre), `src/lib/useThemeMode.ts`, `src/components/ThemeToggle.tsx`.
  L'**infra de variables CSS préexistante a effectivement porté le lot** — le vrai coût n'était
  pas là, mais dans les couleurs **codées en dur hors CSS** : Recharts (grilles, axes,
  infobulles, légendes), rampe de la treemap, couleurs de camembert, et les `#ffffff` posés sur
  les aplats teal. C'est là que se cachait le « mode sombre à moitié appliqué ».
- **D4 — Refonte mobile du tableau.** ✅ **RÉALISÉE (2026-08-30).** Le tableau des
  capitalisations bascule **sous 960 px** en fiches dépliables : trois colonnes essentielles
  (Société · Capitalisation · Var. jour) et le reste **au tap** dans un panneau accordéon.
  Le défilement horizontal est supprimé. Levait le **prérequis dur** qui bloquait toute campagne
  d'audience (C5, intégrations mi-vidéo) — l'audience YouTube/X est majoritairement mobile.
  Fichiers : `MarketCapMobileList.tsx` (seul composant client du lot),
  `src/lib/marketCapPresentation.ts` (règles d'affichage partagées), `src/lib/umami.ts`.

  **RÈGLES DURES — ne jamais « re-simplifier » :**
  - **Le seuil est 960 px, et c'est celui d'`EtfTable`.** C'est le seul autre tableau à
    8 colonnes du site, et il bascule déjà en fiches à 960 px avec le raisonnement écrit dans
    `globals.css` (« un tableau qui se balaie latéralement masque la moitié des colonnes »).
    **Une règle, deux tableaux.** À 900 px on aurait ouvert une bande 900–960 où l'un est en
    fiches et l'autre en tableau, sans explication possible. Ne pas réintroduire un seuil propre.
  - **Deux arbres DOM, le CSS choisit — pas de `matchMedia`.** Le `<table>` desktop et la liste
    mobile coexistent ; `display:none` en masque un. Idiome déjà retenu pour `ThemeToggle`
    (les deux icônes dans le DOM) : **aucun flash d'hydratation**, le HTML initial est juste dans
    les deux cas, et l'arbre caché sort de l'ordre de tabulation → pas de piège clavier. Le
    markup desktop est **strictement inchangé**, `clic-fiche-societe` compris.
  - **AUCUNE infobulle sur mobile.** Le survol n'existe pas au doigt. Tout ce qui est un `title=`
    sur desktop (états P/S ⚠/‡/n.s., variation exceptionnelle ⚑, fraîcheur des actions) devient
    un **texte visible** dans le panneau. Pas de tap-to-reveal : une seconde divulgation à
    l'intérieur d'un accordéon est un piège, et le panneau est déjà un geste explicite.
  - **`src/lib/marketCapPresentation.ts` est la SOURCE UNIQUE des règles d'affichage.** Les six
    états P/S et la fraîcheur du nombre d'actions y sont décidés une fois ; desktop et mobile ne
    font que les baliser différemment. Sans ça la vue mobile aurait été une deuxième copie des
    seuils — exactement la divergence que la centralisation d'`isStale` (C7) a évité.
  - **Le ⚠ de fraîcheur est visible AVANT le dépliage**, sur la ligne repliée, à côté de la
    capitalisation. Signaler sans masquer : un avertissement de qualité de donnée ne se cache pas
    derrière une interaction. Son explication, elle, est dans le panneau.
  - **Événement Umami `depli-ligne-mobile`** (propriété `ticker`), émis **à l'ouverture
    SEULEMENT**. C'est la raison d'être du composant client : `<details name>` donnait
    l'accordéon exclusif sans une ligne de JS, mais `data-umami-event` sur un `<summary>` se
    déclenche aussi à la fermeture → métrique gonflée ~×2, **silencieusement**. Rejeté au titre
    de « un chiffre faux est pire qu'un chiffre absent ». Seule exception à la convention de
    nommage `clic-*` : déplier n'est pas un clic sortant.
  - **`formatShares` ≠ `formatQty`.** Un nombre d'actions est un entier ; `formatQty` (2 à 4
    décimales) sert aux quantités de portefeuille, fractionnaires par construction (19,7722
    GOOGL en PER). « 5 867 155 790,00 actions » est une fausse précision au centième d'action.
    La copie locale qu'en portait `DilutionSection` est supprimée au profit de `format.ts`.

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
  - `clic-fiche-societe` — accès à une fiche société, propriété `data-umami-event-ticker`.
  - `clic-youtube-fiche` — lien vidéo en bas de fiche société, propriété `-ticker`.
  - `clic-source-evenement` — lien vers la source primaire d'un événement (C6).
  - `clic-indice` — accès à l'Indice TQW : lien nav du header ET bandeau d'accueil
    (`SiteHeader.tsx`, `IndexHomeBanner.tsx`). Mesure l'attrait de l'IP propriétaire (C3).
  - `clic-theme` — bascule clair / sombre (`ThemeToggle.tsx`, D3). Mesure l'usage réel du
    mode sombre : sans ce chiffre, on ne saura jamais si la brique méritait son coût.
  - `depli-ligne-mobile` — dépliage d'une ligne du tableau des capitalisations en vue mobile
    (`MarketCapMobileList.tsx`, D4), propriété `ticker`. Émis **à l'ouverture seulement**.
    Seul événement non préfixé `clic-` : ce n'est pas un clic sortant. Mesure quelles sociétés
    intriguent assez, sur mobile, pour qu'on aille chercher le détail.
- **RÈGLE DE CESSION (dure)** : **exporter les données Umami avant tout changement d'outil
  d'analytics**. La continuité de la courbe d'audience est un **actif du dossier de cession**
  (thèse d'acquisition — audience mesurée et possédée). Une rupture d'historique détruit
  la démonstration d'audience ; l'export préalable est non négociable.

### C2 — Fiches sociétés — ✅ RÉALISÉE (2026-07-17)

**Ce qui est construit :** pages `/societe/[ticker]` pour les **13 acteurs** du suivi sectoriel —
graphique de capitalisation historique, P/S dans le temps, variations multi-horizons, notes
éditoriales existantes (Up-C QNT, quantum washing ARQQ, flags ⚑/‡), et **méthodologie de la donnée**
affichée en clair. Réutilise **100 % des données déjà en base** — aucune nouvelle source.

**Objectif SEO :** capter la requête « nom d'entreprise + bourse / action » (cohérent avec la
Règle 1 §3 de la bible éditoriale, appliquée au site). Ces pages deviennent la **destination des
intégrations mi-vidéo** (§10) — le lien qu'on pose sous une vidéo pointe vers la fiche société.

**Dépendances :** S1 (market cap) + S2 (variations) + S-P/S (ratio). Aucune source externe nouvelle.

**État réel (implémentation) :**
- **Route** : `src/app/societe/[ticker]/page.tsx` (Server Component, ISR 24 h, `dynamicParams = false`
  → seuls les 13 tickers existent, tout autre renvoie un 404). URLs en **minuscules**
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

#### État réel (2026-08-16) — module livré

- `scripts/edgar.py` — couche d'accès EDGAR **isolée** (même statut que `market_data.py`) :
  User-Agent nominatif, throttle < 10 req/s, cache disque, 3 tentatives. Briques génériques
  réutilisables pour **S8** (USAspending, NSF, DARPA). Carte `TICKER_CIK` en dur — un CIK ne
  change pas, une résolution par ticker casserait le jour où un ticker est réattribué
  (piège déjà vécu : `IQM` → Franklin Intelligent Machines ETF).
- `scripts/backfill_shares_history.py` — historique annuel des actions depuis les 10-K/20-F/40-F.
- `scripts/fetch_financials.py` — liquidités, consommation et dépôts déclarés → migration 013.
- `scripts/check_dilution.py` — tableau de contrôle **lecture seule** ; `--liquidites` sort le
  seul tableau des liquidités avec le contrôle croisé (n'ouvre aucune connexion Supabase).
- Front : `src/lib/dilution.ts` (miroir TS de `check_dilution.py`), `DilutionSection.tsx`
  (Server Component, mini-graphique en **barres CSS** — aucun JS client), migration 013.

**RÈGLES DURES — apprises en production, ne jamais « re-simplifier » :**

- **Le RUNWAY se calcule sur les ressources liquides TOTALES** — trésorerie + placements
  courants **+ placements NON courants**. Ces sociétés échelonnent leur portefeuille obligataire
  au-delà de 12 mois ; ignorer le non-courant donnait à **RGTI 27,8 M$ au lieu de 541,3 M$** et
  ~2 trimestres d'autonomie à une société **sans dette** qui en a plus de trente, et à **IONQ
  2 119 M$ au lieu de 2 959 M$**. Une fausse alerte de trésorerie est l'erreur la plus coûteuse
  du module : plausible, alarmante, et elle survit à la relecture.
- **UNE SEULE VALEUR PAR SEAU, jamais de somme de synonymes.** Les tags d'un même seau sont des
  dénominations concurrentes, pas des composantes. QBTS publie `MarketableSecuritiesCurrent`
  (249,573 M$) **et** `DebtSecuritiesAvailableForSaleExcludingAccruedInterestCurrent`
  (249,600 M$) : même ligne de bilan, à l'intérêt couru près. Résolution par **ordre de priorité**,
  premier tag trouvé, tag retenu affiché. Un garde-fou signale toute divergence > 2 % entre tags
  d'un même seau — la priorité n'est légitime que tant qu'ils s'accordent.
- **Les noms de tags varient d'un émetteur à l'autre — vérifier TAG PAR TAG.** RGTI n'utilise
  aucun des trois tags « évidents » : elle balise en `DebtSecuritiesAvailableForSaleExcludingAccruedInterest{Current,Noncurrent}`.
  Sonde de référence exécutée le 2026-08-16 sur les 13 sociétés, correspondance documentée en
  tête de `edgar.py`. **Ne jamais présumer d'un jeu de tags universel.**
- **JAMAIS d'agrégat de portefeuille.** `AvailableForSaleSecuritiesDebtSecurities` (sans suffixe
  Current/Noncurrent) totalise l'AFS **y compris les titres classés en équivalents de trésorerie**.
  Chez IONQ il vaut 2 966,9 M$ quand courant + non courant font 1 723,6 M$ : l'ajouter à la
  trésorerie double-compterait 1,2 G$. Exclu par construction.
- **CONTRÔLE CROISÉ BLOQUANT au communiqué (±10 %).** Ancres dans `check_dilution._LIQUIDITY_ANCHORS`
  (SOURCE UNIQUE, importée par `fetch_financials.py`). Au-delà du seuil, la ligne **n'est pas
  écrite** et le runway n'est pas publié — `emit_error`, sortie en code 1. Au 2026-08-16 :
  RGTI 541,3 (−0,0 %) · QBTS 550,4 vs 546,2 (+0,8 %, le communiqué s'arrête aux titres courants) ·
  QNT 2 106,7 vs ≈2 100 (+0,3 %) · IONQ 2 959,3 vs ≈3 000 (−1,4 %) · QUBT 1 323,5 vs ≈1 300 (+1,8 %).
- **IONQ — ne pas ancrer sur les ~2 Md$ pro forma.** L'acquisition SkyWater a clôturé **après**
  le 30/06, donc hors bilan du 10-Q. Les deux chiffres sont justes et ne mesurent pas la même
  date ; le pro forma est affiché en **note**, jamais en ancre.
- **QUBT — ne jamais revenir à 954 M$.** Ce chiffre, un temps porté par notre saisie C6, est
  trésorerie + placements **courants seuls** (189,150 + 765,020 = 954,170) : exactement le
  périmètre partiel corrigé ici. La société écrit « Ends quarter with **$1.3 billion** in cash,
  cash equivalents and investments ». Recoupement indépendant sur une seconde date : ≈1,5 G$
  annoncé au 31/12/2025, nos tags donnent 1 520,4 M$. **C6 corrigé à la source** le 2026-08-16
  (événement `QUBT 2026-08-10`, 8-K ex. 99.1).
- **DEUX SEUILS DE FRAÎCHEUR, à ne pas confondre.** **150 j** (≈ 5 mois) → on publie **avec ⚠** et
  la date en évidence : même seuil et même marqueur que les « données anciennes » du tableau S1
  (doctrine LAES), pour qu'un lecteur n'ait pas deux grilles de lecture. **270 j** (9 mois) → **plus
  de runway du tout**, le relevé reste affiché avec sa date, sans projection. Cas **ARQQ**, arrêté
  au 31/03/2025 : ses 6-K intermédiaires ne sont pas balisés en XBRL.
- **RUNWAY PLAFONNÉ À 20 TRIMESTRES à l'affichage** → « > 5 ans au rythme actuel — projection non
  contraignante ». « ~112 trimestres » (QUBT) est exact et illisible : personne ne pilote une
  trésorerie à 28 ans, et le chiffre donne une fausse précision à une projection qui supposerait
  la consommation constante pendant trois décennies. Le calcul reste entier dans le tableau de
  contrôle. `runway_label` (Python) et `runwayLabel`/`RUNWAY_CAP_QUARTERS` (TS) sont **miroirs**.
- **RUPTURE DE BASE DE MESURE — couper, jamais moyenner.** Au-delà de +2 000 %/an entre deux
  relevés, ce n'est plus de la dilution mais un changement de périmètre. Cas **QNT** : yfinance
  31,4 M (flottant Class A) puis 424B4 322 M (Up-C) donnait +39 572 938 %/an. La série est coupée
  à la rupture **et la rupture est affichée** — jamais de coupe silencieuse.
- **AUCUN SCORE PRÉDICTIF** (règle §10). Les dépôts déclarés sont nommés par leur **forme exacte**
  (S-3, F-3, 424B5…) et jamais qualifiés d'« ATM » : ce serait une inférence habillée en fait.
  424B3 (revente par des porteurs existants) est volontairement exclu — ce n'est pas une émission
  de titres nouveaux. La dilution n'est jamais colorée en vert/rouge : c'est un fait, pas une
  performance.
- **`isStale` centralisé dans `src/lib/dilution.ts`.** La page fiche et `MarketCapTable` en
  portaient chacune une copie du seuil de 150 j ; une troisième pour les liquidités aurait garanti
  la divergence.
- **Piège d'outillage — le cache de données de Next masque un backfill.** Après une écriture en
  base, un `npm run build` sert les réponses mises en cache dans `.next/cache` : les fiches ont
  affiché **un seul point d'historique** alors que la base en contenait six. `rm -rf .next/cache`
  avant toute vérification visuelle post-backfill. En production, l'équivalent est la purge via
  `/api/revalidate`.

**Migrations :** **012** (`share_adjustment` — journal d'audit des splits ; les valeurs de
`shares_outstanding` sont **déjà** ajustées, ne JAMAIS appliquer `ratio` comme multiplicateur) et
**013** (`company_financials` + `company_filing`). Dérogation raisonnée au principe « ne jamais
stocker le calculable » : ces chiffres se **lisent** dans un dépôt daté, ils ne se calculent pas —
même nature que `shares_outstanding` ou `sector_event`. Le **runway n'est pas stocké** : il se
recalcule à la lecture, et sa mise en forme (plafond, suppression au-delà de 9 mois) est une
décision d'affichage.

### C3 — Indice TQW (indice propriétaire) — ✅ RÉALISÉE (2026-08-01)

**Pourquoi :** c'est la **propriété intellectuelle licenciable** du projet — modèle MarketVector.
L'indice, sa méthodologie et son historique constituent un actif cessible indépendamment du site.
Nom définitif : **Indice TQW** (le nom de travail « Indice IQ » est abandonné).

**Méthodologie (document publié : `docs/methodologie-indice-tqw.fr.md`, SOURCE UNIQUE) :**
- **Base 100 au 2026-06-01** (même date que l'inception des portefeuilles).
- **Univers** = `asset.category = 'pure_player'` — défini EN BASE, jamais par une liste en dur.
  C'est la traduction mécanique de la règle « société cotée sur une place majeure dont l'activité
  principale est le quantique ». Exclus par leur catégorie : GOOGL/IBM (`geant`), NVDA
  (`infrastructure`), QNTM.L/QQQ (`etf`).
- **Entrée** : au 1er rebalancement suivant **30 séances cotées** révolues (règle
  anti-données-fantômes — historiques de SPAC servis par yfinance, cas IQMX/RAAQ).
- **Sortie** : radiation, acquisition, ou activité principale qui cesse d'être le quantique.
- **Pondération par capitalisation TOTALE**, non flottante. **Doctrine du Wall** : QNT est
  pondérée en **pleinement dilué** (Class A + Class B Honeywell, 322 M actions) — le flottant seul
  diviserait sa capitalisation par dix. Note Up-C affichée en bas de tableau.
- **Plafond de 25 % par valeur**, par waterfall itératif (un écrêtage peut en provoquer un second).
- **Rebalancement trimestriel** : 1re séance cotée à partir du 1er février / mai / août / novembre,
  aligné sur le cron des fondamentaux (les actions viennent d'être rafraîchies).
- **Diviseur** : ajusté à chaque rebalancement pour une continuité parfaite (valeur du jour avec
  les anciens paramètres → nouvelle composition → diviseur qui redonne exactement cette valeur).
  Vérifié : écart de continuité **0,000000** à la simulation d'entrée de QNT.

**RÈGLES DURES — ne jamais « re-simplifier » :**
- **Le plafond ne s'applique QU'AU REBALANCEMENT.** Entre deux rebalancements les poids **dérivent
  librement** avec les cours et peuvent dépasser 25 %. C'est **voulu** : un indice qui réécrête en
  continu est un portefeuille géré, pas un indice. La page affiche les DEUX colonnes (poids au
  rebalancement / poids courant) côte à côte — l'écart doit être lisible, jamais dissimulé.
- **⚠ `backfill_sectoral.py` EST UN VECTEUR DE RÉTROACTIVITÉ (constaté le 2026-08-31).** Il
  **réécrit `adj_close` sur TOUT l'historique**, pas seulement les dates manquantes. Si yfinance
  a révisé un cours passé, la révision entre en base et le recalcul de l'indice ne reproduit plus
  la série publiée. Constaté après le backfill d'ajout de PSQL : dérive sur **2 séances sur 63**
  (2026-08-06 : +2,00 point ; 2026-08-14 : +0,001), les 61 autres à l'identique. `index_daily`
  n'a **pas** été touché et les 3 autres contrôles durs passent — le garde-fou a fonctionné comme
  prévu : il **signale, il n'écrase pas**. **NE JAMAIS « corriger » par `backfill_index.py
  --rebuild`** : ce serait réécrire une série publiée pour la faire coller à une donnée révisée,
  exactement ce que la non-rétroactivité interdit. Le réflexe correct est d'identifier le cours
  révisé AVANT de relancer un backfill complet, ou de se limiter aux dates manquantes.
- **NON-RÉTROACTIVITÉ.** Une valeur publiée n'est **jamais** recalculée. Un split réécrit
  `adj_close` rétroactivement et une surcharge SEC peut être rétro-datée ; ni l'un ni l'autre ne
  doit altérer la série publiée. Les scripts n'écrivent que les dates manquantes ;
  `check_index.py` rejoue la chaîne et **signale** toute dérive au lieu de l'écraser.
- **Univers MÉCANIQUE, jamais éditorial.** ARQQ figure dans l'indice parce qu'elle satisfait les
  critères formels ; son avertissement *quantum washing* (†) reste affiché mais n'influence **pas**
  la composition. Ne jamais laisser une opinion décider d'un chiffre.
- **Calcul dans l'ingestion, jamais dans le front.** `/indice` LIT `index_daily`. Seuls les **poids
  courants** sont dérivés à la lecture (paramètres figés × cours du jour), jamais stockés.

**Implémentation :**
- **Migration 010** (`supabase/migrations/010_index_tqw.sql`) : `index_daily` (date, value, divisor)
  + `index_weights` (composition figée par rebalancement : shares, price, weight_raw,
  weight_capped, cap_factor, shares_source). **Dérogation raisonnée** au principe « ne jamais
  stocker le calculable » : une valeur d'indice dépend d'une chaîne de décisions datées, elle n'est
  pas dérivable d'un prix — même nature que `shares_outstanding` ou `sector_event`.
  `price`/`weight_*` sont le **dossier d'audit** du rebalancement, pas un cache.
- `scripts/index_tqw.py` — moteur **isolé** (comme `market_data.py` / `guards.py`) : toute la
  méthodologie y vit. Garde-fous : cours reporté au-delà de 5 séances → `emit_error` + arrêt
  (jamais de valeur partielle) ; constituant sans actions connues → exclu + alerte ; lectures
  paginées `.range()` (plafond PostgREST 1000 lignes).
- `scripts/ingest.py` — **étape 5** `_update_index`, enveloppée en `try/except` comme
  `_log_market_caps` : l'indice ne peut jamais faire échouer l'ingestion des portefeuilles.
- `scripts/backfill_index.py` — reconstruction depuis l'inception (`--rebuild` purge délibérée).
- `scripts/check_index.py` — tableau de contrôle **lecture seule**, 4 contrôles durs : inception
  = 100,000000 · Σ poids = 100 % · aucun poids > 25 % au rebalancement · recalcul ≡ série publiée.
- Front : `fetchIndexData` / `fetchIndexSummary` (`api.ts`, dégradation gracieuse si migration
  absente), `IndexChart(Impl)`, `IndexConstituentsTable`, `IndexHomeBanner`, `/indice` (ISR 24 h).
  Méthodologie rendue depuis `docs/*.fr.md` via `react-markdown` + `remark-gfm` — **source unique,
  zéro dérive**. `outputFileTracingIncludes` dans `next.config.ts` embarque `docs/` côté serverless.
- SEO : title absolu « Indice TQW — l'indice des pure-players du quantique coté », canonical, OG,
  sitemap (priorité 0.9), `/indice` ajouté à la purge par défaut de `/api/revalidate`.
- **Événement Umami `clic-indice`** — lien nav du header + bandeau d'accueil (cf. C1).

**Calendrier des rebalancements (à surveiller) :**

| Date | Événement |
|---|---|
| 2026-06-01 | Lancement — **9 constituants**, base 100, diviseur 3,47223e+08. Écrêtées : IONQ (47,94 % brut → 25 %), QBTS (19,87 % → 25 %) |
| **2026-08-03** | Entrée de **QNT** (30 séances franchies le ~17/07) → 10 constituants. Le 1er août est un samedi |
| **2026-11-02** | **Double entrée attendue : IQMX + PSQL** (IQMX 21 séances au 31/07 ; PSQL cotée le 28/08, 30e séance ~mi-octobre) → 12 constituants. ⚠ PSQL n'entre que si son décompte d'actions est publié d'ici là |

⚠ **QNT n'était PAS au lancement** : son IPO (04/06/2026) est postérieure de 3 jours à la date de
base. Aucune exception n'a été ajoutée — la règle des 30 séances produit ce résultat d'elle-même.

**Contrôle croisé au 2026-07-31 (à re-vérifier à chaque évolution de méthodologie) :**
Indice TQW −40,79 % · VanEck QNTM.L −18,61 % · Nasdaq-100 QQQ −7,37 % depuis le 01/06.
L'écart de 22 points est **structurel, pas un artefact** : sur les mêmes constituants, la capi non
plafonnée donne −42,79 % et l'équipondérée −30,76 % — le plafond amortit de 2 points, il ne crée
pas la baisse. L'indice est **structurellement plus volatil** que tout ETF thématique parce qu'il
ne contient aucune grande capitalisation pour amortir. C'est sa raison d'être : aucun instrument
existant ne mesure les pure-players seuls.
Sous-produit éditorial pour **S4** (« exposition déclarée vs réelle ») : une décomposition à deux
facteurs prête au VanEck un comportement de ~34 % pure-player — **inférence tirée des cours**, à
confronter au prospectus avant toute publication.

**Dépendances :** S1 (`shares_outstanding`) + historique `price_daily`. Aucune source externe nouvelle.

**Reporté :** le **PDF téléchargeable** de méthodologie. Le `.md` versionné en git + la page rendue
couvrent le besoin ; le PDF sera généré si une diffusion hors site le justifie.

### C4 — Images OG auto-générées — 🚧 CODÉE (2026-08-09), PAS ENCORE DÉPLOYÉE

**Pourquoi :** boucle virale gratuite — chaque partage social affiche l'état du secteur du jour.

**Ce qui est construit (réel) :** **trois** templates OG en 1200×630, générés par `next/og`
(`ImageResponse`) via la convention de fichier `opengraph-image.tsx`, en **runtime Node** et
**revalidation 24 h** (alignée sur les pages) :
- `src/app/opengraph-image.tsx` — accueil, **le mur** ;
- `src/app/societe/[ticker]/opengraph-image.tsx` — les 13 fiches ;
- `src/app/indice/opengraph-image.tsx` — Indice TQW.
Socle partagé dans `src/lib/og.tsx` (cadre de marque, palette, police, helpers) ; libellés sous
`t.og.*` (`src/i18n/fr.ts`), aucune string en dur.

**⚠️ ÉCART ASSUMÉ vs le plan initial — barres, pas treemap.** L'accueil rend des **barres
horizontales proportionnelles** à la capitalisation, colorées par la variation du jour, et non la
treemap du Mur. Raison : une treemap réduite à ~300 px de large (taille réelle d'une carte dans un
fil X) devient une mosaïque illisible, alors qu'une pile de barres alignées donne l'effet
« mur rouge/vert » d'un coup d'œil en gardant les tickers déchiffrables. **L'effet mur prime sur la
fidélité de la treemap** ; `/mur` reste la vue exacte. Conséquence : **C4 ne dépend plus de S3.**

**RÈGLES DURES — apprises au montage, ne pas « re-simplifier » :**
- **Lisibilité en miniature d'abord.** Rien sous ~19 px à l'échelle 1200×630. Le mur est **borné à
  8 barres** (`MAX_BARS`) : c'est le plancher pour que les tickers restent lisibles réduits. Le
  panel en compte 11 → **la troncature est ANNONCÉE** (« + 3 autres pure-players »), jamais
  silencieuse.
- **Date des données sur chaque image** (`OgShell`). Une carte partagée sans date est un chiffre
  sans contexte qui vieillit en silence.
- **Les notes éditoriales suivent sur la carte.** Le marqueur du ticker (`TICKER_NOTES` : Up-C QNT,
  quantum washing ARQQ †, cotation récente IQMX §) est rendu sur la fiche OG. Une carte circule
  **plus loin que la page** : y afficher une capitalisation sans son avertissement contredirait la
  règle de la maison.
- **Police embarquée EN FICHIER** (`src/assets/fonts/IBMPlexSans-SemiBold.ttf`, OFL 1.1, provenance
  et licence dans le README du dossier), jamais récupérée sur le réseau à la génération : un
  partage ne doit pas dépendre de la disponibilité de Google Fonts au passage d'un crawler.
  **`satori` ne lit ni woff2 ni EOT.** Piège vécu : l'API CSS legacy de Google Fonts sert de l'**EOT**
  avec un User-Agent ancien — `file` annonce quand même « IBM Plex Sans SemiBold » et la génération
  échoue. Vérifier les octets de tête : `xxd -p -l4 fichier.ttf` doit donner `00010000`.
- **Tout glyphe affiché sur une carte OG doit EXISTER dans la police embarquée.**
  `IBMPlexSans-SemiBold.ttf` ne couvre que 895 points de code. Un glyphe absent ne dégrade pas :
  satori tente un **téléchargement de police à la volée**, qui échoue au build
  (« *Failed to download dynamic font. Status: 400* ») — exactement ce que l'embarquement en
  fichier était censé éliminer. Les marqueurs de `TICKER_NOTES` sont rendus sur les fiches OG :
  `*` `†` `§` `¶` `‡` `·` `•` `◊` `°` sont couverts ; **`◦` `∘` `‖` `⚠` `⚑` ne le sont pas**
  (⚠ et ⚑ ne vivent que dans le HTML, jamais dans une image OG — ne pas les y introduire).
  Vérifier avant d'ajouter un marqueur : lire la table `cmap` du `.ttf`, ne pas se fier à l'œil.
  Attrapé au build lors de l'ajout de PSQL, où `◦` avait été retenu d'abord.
- **`outputFileTracingIncludes` pour les trois routes** (`next.config.ts`) — sans quoi le `.ttf`
  n'est pas dans le bundle serverless Netlify (même raison que `docs/` pour `/indice`).
- **Casse des params identique à la page.** Les URLs de fiches sont en **minuscules** : un
  `generateStaticParams` qui rend `IONQ` prerend une image à une URL que la page ne référence
  jamais, et la carte est regénérée à la demande à chaque partage. Bug attrapé au build.
- **Une image OG est une entrée de cache DISTINCTE de sa page.** Purger `/indice` ne rafraîchit pas
  `/indice/opengraph-image` : les trois routes sont ajoutées à la purge par défaut de
  `/api/revalidate`. Sans ça, une correction de donnée s'affiche sur le site pendant que X montre
  encore l'ancien chiffre — l'écart le plus visible possible.
- **`twitter.card = 'summary_large_image'`** (`layout.tsx`, était `summary`). Avec `summary`, X
  réduit la carte à une vignette carrée et la brique perd sa raison d'être. **Effet sitewide**, pas
  seulement sur les trois routes.
- **Dégradation gracieuse.** Base injoignable ou migration absente → carte de **marque** valide
  (wordmark + « chiffres momentanément indisponibles »), jamais un 500 ni une image vide qui
  casserait l'aperçu du partage.

**Vérification (2026-08-09) :** trois rendus contrôlés visuellement, dont deux cas limites — ARQQ
(note longue sur une ligne) et HQ (P/S `n.s.`, données pauvres). `tsc` propre ; `npm run lint`
inchangé (les 9 `<a>` de la dette (d), aucune erreur nouvelle) ; `npm run build` exit 0 avec les
13 fiches OG prerendues et le `.ttf` tracé dans les trois manifestes `.nft.json`.

**⚠️ ÉTAT : non déployé.** Une route OG **n'existe pas en prod tant que le commit n'est pas poussé**
— la convention de fichier ne crée rien à l'exécution. Symptôme d'un oubli de push : `404` sur
`/opengraph-image` **et balise `og:image` absente du HTML de prod**. Diagnostic en deux commandes,
avant tout soupçon porté au runtime Netlify :
```bash
git rev-list --left-right --count origin/main...HEAD      # 0 0 = rien à déployer d'inédit
curl -s https://thequantumwall.com/ | grep -o 'og:image[^>]*'   # vide = code absent du build
```
Si `og:image` est **présente** mais l'URL en 404, alors seulement chercher côté adaptateur Netlify
(les *metadata routes* de Next ont des cas connus) — et le contournement est une route explicite
`/api/og/...` rendant le même `ImageResponse`, indépendante de la convention de fichier.

**Dépendances :** S1 (market cap) + S2 (variations) + C3 (indice). **Plus S3** depuis l'abandon de
la treemap comme source visuelle.

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
- **(d) Migration `<a>` → `next/link` — PASSE DÉDIÉE, jamais au fil de l'eau.** Toute la navigation
  interne utilise des `<a href="…">` : `npm run lint` échoue en permanence sur
  `@next/next/no-html-link-for-pages` (9 occurrences au 2026-08-06 — header, `/indice`,
  `/etf-quantiques`, `/grille-etf`, fiches sociétés, pages portefeuille). Conséquences : navigation
  client non préchargée (rechargement complet à chaque clic, pénalisant sur mobile) et **un lint
  rouge de référence, qui masque les vraies régressions** au moment d'une revue.
  **Règle en attendant : rester cohérent avec le repo** — une nouvelle page écrit des `<a>` comme
  les autres. Mélanger les deux conventions coûterait plus cher que la dette elle-même. La bascule
  se fait **en une seule passe sur tous les fichiers**, lint remis à zéro dans le même commit,
  sans rien changer d'autre.

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
