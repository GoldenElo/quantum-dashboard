## Ce que mesure l'indice

L'**Indice TQW** mesure la performance agrégée des **pure-players du quantique coté** — les
sociétés dont le quantique est l'activité principale, à l'exclusion des conglomérats
diversifiés pour qui il n'est qu'une ligne de recherche parmi d'autres.

Il est publié par **The Quantum Wall**, édité par **L'Investisseuse Quantique**.

**Base 100 au 1er juin 2026.** Une valeur de 60 signifie que le panier a perdu 40 % depuis
cette date.

L'indice est **informatif et non investissable**. Il ne constitue ni un conseil ni une
recommandation d'investissement, et aucun produit financier ne le réplique.

## Univers

Est éligible toute société **cotée sur une place majeure** (NYSE, Nasdaq) dont **l'activité
principale est le quantique**. Dans la base du Wall, cette règle correspond exactement à la
catégorie `pure_player`.

Sont donc exclus, par construction et sans exception écrite :

| Exclus | Motif |
|---|---|
| Alphabet (GOOGL), IBM | conglomérats diversifiés — le quantique est une activité minoritaire |
| Nvidia (NVDA) | infrastructure de calcul, pas un acteur quantique |
| VanEck (QNTM.L), Invesco (QQQ) | ETF — instruments, pas des sociétés |

L'appartenance à l'indice est **mécanique**, jamais éditoriale. Arqit (ARQQ) y figure parce
qu'elle satisfait les critères formels, bien que le Wall documente par ailleurs son profil de
*quantum washing*. L'avertissement reste affiché sur sa fiche ; il n'influence pas la
composition de l'indice. **Signaler sans masquer** — mais ne jamais laisser une opinion
décider d'un chiffre.

### Entrée — la règle des 30 séances

Une société nouvellement cotée entre au **premier rebalancement suivant 30 séances cotées
révolues**.

Ce délai n'est pas cosmétique. Il neutralise deux risques réels et documentés :

- **les historiques fantômes** — pour une société issue d'une fusion SPAC, le fournisseur de
  données sert souvent l'historique du véhicule d'acquisition sous le nouveau ticker (cas IQM
  Quantum Computers, dont le ticker a longtemps renvoyé les cours du SPAC RAAQ autour de la
  valeur de trust) ;
- **les premières séances non représentatives** — volumes erratiques, absence de flottant
  stabilisé, écarts de cotation extrêmes.

### Sortie

Une société sort de l'indice en cas de **radiation**, d'**acquisition**, ou lorsque son
activité principale cesse d'être le quantique. La sortie prend effet au rebalancement suivant,
sauf radiation ou acquisition effective — auquel cas elle intervient dès la séance suivante,
avec ajustement du diviseur.

## Pondération

L'indice est pondéré par **capitalisation boursière totale**, et non par capitalisation
flottante.

`capitalisation = nombre total d'actions × cours de clôture ajusté`

Le nombre d'actions retenu est le dernier connu à la date du rebalancement, issu des documents
déposés auprès des régulateurs (10-Q, 10-K, 6-K, prospectus) ou, à défaut, du fournisseur de
données. Toute surcharge manuelle est **sourcée et datée**.

**Doctrine du Wall — pleinement dilué.** Lorsqu'une société présente une structure à double
classe d'actions, l'indice retient le **total des actions, toutes classes confondues**, et non
le seul flottant public. Quantinuum (QNT) est ainsi pondérée sur sa structure Up-C complète —
Class A publique plus Class B détenue par Honeywell — soit 322 millions d'actions, là où une
lecture du seul flottant diviserait sa capitalisation par dix. Mesurer une entreprise sur 10 %
d'elle-même n'est pas une convention, c'est une erreur.

### Plafond de 25 %

Aucune valeur ne peut peser plus de **25 %** de l'indice **au moment du rebalancement**.

Le plafonnement procède par **cascade itérative** : les valeurs au-dessus du plafond y sont
ramenées, l'excédent est redistribué au prorata sur les autres, et l'opération se répète
jusqu'à ce qu'aucune valeur ne dépasse le seuil — un écrêtage pouvant en provoquer un second.

Le plafond n'est pas décoratif. Au lancement, IonQ pesait **47,9 %** de la capitalisation
brute du panier : sans plafond, l'indice aurait mesuré IonQ, pas le secteur.

| Rebalancement du 1er juin 2026 | Poids brut | Poids retenu |
|---|---|---|
| IonQ (IONQ) | 47,94 % | **25,00 %** |
| D-Wave (QBTS) | 19,87 % | **25,00 %** |
| Rigetti (RGTI) | 15,79 % | 24,54 % |
| Infleqtion (INFQ) | 7,16 % | 11,12 % |
| Quantum Computing Inc (QUBT) | 5,18 % | 8,05 % |
| SEALSQ (LAES) | 1,47 % | 2,28 % |
| Xanadu (XNDU) | 1,29 % | 2,01 % |
| Horizon Quantum (HQ) | 0,75 % | 1,17 % |
| Arqit (ARQQ) | 0,55 % | 0,85 % |

### La dérive entre deux rebalancements est voulue

**Le plafond ne s'applique qu'au rebalancement.** Entre deux rebalancements, les poids
**dérivent librement avec les cours** et peuvent dépasser 25 %.

C'est un choix de méthodologie, pas un défaut. Un indice qui réécrêterait en continu serait un
**portefeuille géré**, pas un indice : il vendrait implicitement ce qui monte et rachèterait ce
qui baisse, à chaque séance. Un indice enregistre le marché ; il ne le corrige pas.

Les poids courants affichés sur la page de l'indice sont donc les **poids réels dérivés**, et
la page les présente systématiquement **à côté** des poids de rebalancement, pour que l'écart
soit lisible plutôt que dissimulé.

## Rebalancement

L'indice est rebalancé **quatre fois par an** : à la première séance cotée à partir du
**1er février, 1er mai, 1er août et 1er novembre**.

Ce calendrier est aligné sur le rafraîchissement trimestriel des données fondamentales du
Wall : au moment du rebalancement, les nombres d'actions viennent d'être mis à jour à partir
des publications réglementaires.

Lorsque le 1er du mois n'est pas une séance cotée, le rebalancement prend effet à la première
séance suivante — le 1er août 2026 tombant un samedi, le rebalancement a pris effet le lundi
3 août.

| Date | Événement |
|---|---|
| 1er juin 2026 | Lancement — 9 constituants, base 100 |
| 3 août 2026 | Entrée de Quantinuum (QNT) — 10 constituants |
| 2 novembre 2026 | Entrée attendue d'IQM Quantum Computers (IQMX) |

## Le diviseur

La valeur de l'indice s'écrit :

`Indice(t) = Σ [ actions(i) × facteur(i) × cours(i, t) ] / diviseur`

où le **nombre d'actions** et le **facteur de plafonnement** de chaque constituant sont **figés
au dernier rebalancement**. Seuls les cours varient d'une séance à l'autre — c'est ce qui fait
dériver les poids.

Le **facteur de plafonnement** vaut `poids retenu / poids brut`, normalisé pour que la plus
grande valeur soit 1,0. Une société non écrêtée porte donc un facteur de 1,0 ; IonQ portait
0,336 au lancement.

Le **diviseur** est la constante qui assure la **continuité de la série**. À l'inception, il
est fixé pour que l'indice vaille exactement 100. À chaque rebalancement, il est recalculé
ainsi :

1. on calcule la valeur de l'indice du jour avec les **anciens** paramètres ;
2. on établit la nouvelle composition ;
3. on fixe le nouveau diviseur pour que celle-ci donne **exactement la même valeur**.

L'indice bouge donc normalement le jour d'un rebalancement — c'est une séance de marché comme
une autre. Ce qui ne crée aucun saut, c'est le **changement de composition** : l'entrée de
Quantinuum, la sortie future d'une société radiée ou la modification d'un plafond sont
absorbées intégralement par le diviseur.

Diviseur au lancement : **347 223 000** environ (valeur exacte conservée en base).

## Non-rétroactivité

**Une valeur publiée n'est jamais recalculée.**

Deux événements peuvent modifier rétroactivement les données sous-jacentes : un *split* (qui
réécrit tout l'historique des cours ajustés) et une surcharge du nombre d'actions datée du
passé. Ni l'un ni l'autre ne doit altérer une série déjà publiée — sans quoi l'historique de
l'indice cesserait d'être un enregistrement pour devenir une opinion révisable.

Le contrôle quotidien rejoue l'intégralité de la chaîne et la confronte à la série publiée.
Tout écart est **signalé** ; il n'est jamais écrasé en silence.

## Ordres de grandeur — l'indice est plus volatil qu'un ETF thématique

L'Indice TQW est **structurellement plus volatil et plus profond en drawdown** que n'importe
quel ETF thématique quantique. C'est une conséquence directe de sa pureté : il ne contient
aucune grande capitalisation pour amortir les mouvements.

Du 1er juin au 31 juillet 2026 :

| Série | Variation |
|---|---|
| **Indice TQW** (100 % pure-players) | **−40,79 %** |
| VanEck Quantum Computing UCITS (QNTM.L) | −18,61 % |
| Nasdaq-100 (QQQ) | −7,37 % |

Les trois séries racontent la même histoire — un secteur en forte baisse — mais avec des
amplitudes très différentes. Le VanEck se situe entre le Nasdaq-100 et l'indice, ce qui est
la position attendue d'un panier hybride détenant majoritairement des conglomérats.

Cet écart n'est pas un artefact de pondération. Sur les mêmes constituants et la même période,
les trois pondérations envisageables donnent :

| Pondération | Variation |
|---|---|
| Capitalisation non plafonnée | −42,79 % |
| **Capitalisation plafonnée à 25 % (retenue)** | **−40,79 %** |
| Équipondérée | −30,76 % |

Le plafond amortit la concentration d'environ 2 points ; il ne crée pas la baisse. Même dans
l'hypothèse la plus clémente, l'écart avec le VanEck reste de 12 points. **La différence tient
à la composition, pas à la méthode** — et c'est précisément la raison d'être de l'indice :
aucun instrument existant ne mesure les pure-players seuls.

## Limites connues

Elles sont énoncées ici plutôt que découvertes plus tard.

- **Source de données.** Les cours proviennent d'un fournisseur non officiel, en clôture à J‑1.
  Ils sont fiables pour une mesure de tendance, sans garantie contractuelle d'exactitude.
- **Cours ajustés.** L'indice utilise les cours ajustés des splits et dividendes. Croisés avec
  un nombre d'actions courant, ils introduisent un écart de niveau marginal sur la
  capitalisation instantanée — sans effet sur la performance mesurée entre deux rebalancements,
  où les paramètres sont figés.
- **Fraîcheur du nombre d'actions.** Les nombres d'actions sont trimestriels. Une émission
  intervenant entre deux rebalancements n'est prise en compte qu'au suivant.
- **Historique court.** L'indice démarre au 1er juin 2026. Toute mesure sur un horizon
  supérieur est indisponible tant que l'historique n'est pas constitué — elle n'est jamais
  extrapolée.
- **Absence de dividendes.** L'indice est un indice de cours. Les constituants ne versent pas
  de dividende à ce jour ; le cas échéant, ils ne seraient pas réinvestis.

## Avertissement

L'Indice TQW est publié **à titre informatif uniquement**. Il ne constitue **ni un conseil ni
une recommandation d'investissement**. Il n'est **pas investissable** : aucun produit financier
ne le réplique et aucune souscription n'est possible. Les performances passées ne préjugent pas
des performances futures. Données de clôture à J‑1, sans garantie d'exactitude.
