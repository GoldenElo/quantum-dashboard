export const fr = {
  // Métadonnées produit (title / description / OG) — The Quantum Wall est la marque,
  // L'Investisseuse Quantique l'éditeur (cf. Règle 1 de la bible produit).
  meta: {
    title: 'The Quantum Wall — le tableau de bord du quantique coté',
    titleTemplate: '%s · The Quantum Wall',
    description:
      'Portefeuilles quantiques fictifs à but pédagogique et panorama des capitalisations ' +
      'du secteur quantique coté. Données de clôture à J‑1, à titre informatif.',
    siteName: 'The Quantum Wall',
  },
  // Marque affichée dans le header du site.
  header: {
    wordmark: 'The Quantum Wall',
    editeur: 'édité par L’Investisseuse Quantique',
    accueilAria: 'The Quantum Wall — accueil',
  },
  accueil: {
    titre: 'The Quantum Wall',
    // Sous-titre porteur des mots-clés SEO (« tableau de bord du quantique coté »).
    soustitre: 'Le tableau de bord du quantique coté — portefeuilles suivis et panorama sectoriel',
    // Horodatage : preuve visible que le Wall est vivant. La date vient de la base
    // (dernier snapshot), jamais en dur — composée autour de formatDate().
    horodatagePrefix: 'Données du',
    horodatageSuffix: ', clôture US',
  },
  mur: {
    titre: 'HeatMap',
    soustitre:
      'Capitalisations du secteur quantique — taille de tuile proportionnelle à la capitalisation, ' +
      'couleur selon la variation sur l’horizon choisi.',
    // Disclaimer éditorial NON négociable (règle de la chaîne) : jamais un signal d'achat/vente.
    disclaimerEditorial:
      'Performances passées, à titre informatif — ni conseil ni recommandation d’investissement.',
    disclaimerDonnees:
      'Capitalisations indicatives (dernier nombre d’actions connu) · variations sur cours de clôture à J‑1.',
    vueLabel: 'Vue',
    vues: {
      pure_players: 'Pure-players',
      secteur_complet: 'Tout le secteur',
    },
    vuesAria: {
      pure_players: 'Afficher les pure-players quantiques uniquement',
      secteur_complet: 'Afficher tout le secteur, Alphabet et IBM inclus',
    },
    horizonLabel: 'Horizon',
    horizons: {
      jour: 'Jour',
      semaine: 'Semaine',
      mois: 'Mois',
    },
    nonCalculable: '—',
    // Légende de l'échelle divergente
    legende: {
      baisse: 'Baisse',
      neutre: 'Stable',
      hausse: 'Hausse',
      nonCalculableItem: 'Variation non calculable (cotation trop récente)',
    },
    // Garde-fou vue "Tout le secteur" : Alphabet écrase la surface (propos assumé) ;
    // une taille minimale garantit que les pure-players restent identifiables.
    floorNote:
      'En vue « Tout le secteur », Alphabet domine volontairement la surface. Les plus petites ' +
      'tuiles sont affichées à une taille minimale pour rester lisibles — leur aire n’est donc ' +
      'plus strictement proportionnelle à ce niveau d’écart.',
    // Note HQ (volatilité extrême) — propre au Mur, volontairement HORS du TICKER_NOTES
    // partagé pour ne pas altérer le tableau des capitalisations existant.
    hqNote: {
      marker: '‡',
      text: 'cotation très récente (fusion SPAC) — volatilité extrême, à interpréter avec prudence',
    },
    // Infobulle du marqueur de variation exceptionnelle (miroir du tableau caps)
    variationExceptionnelle:
      'Variation exceptionnelle — forte volatilité, cotation récente. À interpréter avec prudence.',
    marqueursTitre: 'Repères',
    aria: {
      region: 'HeatMap — treemap des capitalisations du secteur quantique',
      tuile: 'Capitalisation et variation',
    },
  },
  secteur: {
    titre: 'Capitalisations du secteur',
    colonnes: {
      societe: 'Société',
      ticker: 'Ticker',
      cours: 'Cours',
      capitalisation: 'Capitalisation',
      actionsAu: 'Actions au',
      jour: 'Jour',
      semaine: 'Semaine',
      mois: 'Mois',
      ps: 'P/S',
    },
    // Ratio P/S — affichage à deux niveaux. Les DEUX marqueurs sont de nature
    // distincte et ne doivent pas se confondre visuellement :
    //   ⚠ = données fiables mais valorisation extrême · ‡ = données incertaines.
    ps: {
      insignifiant: 'n.s.',
      extremeMarker: '⚠',
      incertainMarker: '‡',
      extremeTooltip:
        'P/S supérieur à 200 — valorisation très élevée rapportée au chiffre d’affaires actuel, ' +
        'caractéristique d’un secteur en phase pré-revenus. À interpréter comme un signal, pas comme une erreur.',
      partielTooltip:
        'Estimation — chiffre d’affaires partiel, société cotée depuis peu (moins de 4 trimestres publiés). ' +
        'À ne pas interpréter comme un ratio ferme.',
      nonRecoupeTooltip:
        'Estimation — chiffre d’affaires non recoupé (détail trimestriel indisponible). ' +
        'À ne pas interpréter comme un ratio ferme.',
      insignifiantTooltip:
        'Non significatif — chiffre d’affaires quasi nul, le ratio n’a pas de sens à ce stade.',
    },
    totalPurePlayers: {
      libelle: 'Capitalisation totale pure-players',
      note: 'Hors Alphabet · IBM (géants diversifiés)',
    },
    disclaimer: "Capitalisations indicatives, calculées sur le dernier nombre d'actions connu. À titre informatif.",
    // Infobulle sur la capitalisation : transparence sur la fraîcheur du nombre d'actions
    actionsTooltip: "Nombre d'actions au",
    actionsTooltipStale: "(donnée datant de plus de 5 mois)",
    // Infobulle sur une variation hebdomadaire exceptionnelle (anti-hype)
    variationExceptionnelle:
      'Variation exceptionnelle — forte volatilité, cotation récente (SPAC). À interpréter avec prudence.',
  },
  // Fiches sociétés /societe/[ticker] (C2) — pages SEO, destination des intégrations mi-vidéo.
  societe: {
    retour: '← Accueil',
    // SEO — title.absolute (court-circuite le titleTemplate du layout) et description.
    metaTitleSuffix: 'en bourse — capitalisation, valorisation, analyse | The Quantum Wall',
    // Catégories (asset.category) — libellé lisible.
    categories: {
      geant: 'Géant diversifié',
      infrastructure: 'Infrastructure',
      pure_player: 'Pure-player quantique',
      etf: 'ETF',
    } as Record<string, string>,
    // Grille de chiffres actuels.
    chiffres: {
      cours: 'Cours (clôture)',
      capitalisation: 'Capitalisation',
      ps: 'P/S (cours/CA)',
      jour: 'Var. jour',
      semaine: 'Var. semaine',
      mois: 'Var. mois',
      actions: 'Actions en circulation',
    },
    depuisCotation: 'depuis cotation',
    // Fraîcheur du nombre d'actions.
    actionsSourcePrefix: 'Source :',
    actionsAuPrefix: 'au',
    actionsStale: '(donnée datant de plus de 5 mois)',
    // Courbe de capitalisation.
    capChart: {
      titre: 'Capitalisation — historique disponible',
      // Note de méthode obligatoire (honnêteté sur l'approximation).
      methode:
        'Capitalisation reconstituée : cours de clôture × dernier nombre d’actions connu à chaque date. ' +
        'En l’absence d’historique du nombre d’actions, le nombre courant est appliqué rétroactivement — ' +
        'approximation à des fins de tendance, non un relevé historique du flottant.',
      insuffisant: 'Historique insuffisant pour tracer une courbe (cotation trop récente).',
      serieLabel: 'Capitalisation',
    },
    // Bloc de curation éditoriale — mis en avant (différenciation).
    notesTitre: 'Notes de la rédaction',
    // Placeholder Dilution (C7 à venir) — structuré, discret. Le placeholder
    // Événements est remplacé par la frise C6 (voir bloc `evenements` ci-dessous).
    dilution: {
      titre: 'Dilution',
      bientot: 'Historique du nombre d’actions et signaux de dilution — bientôt.',
    },
    // Ligne d'acquisition vers la chaîne (conversion du trafic froid).
    // Deux formulations selon la cible (voir TICKER_VIDEO_URL) : vidéo dédiée à
    // la société, ou playlist générale en attendant une vidéo dédiée.
    acquisitionDediee: 'L’analyse de {societe} en vidéo',
    acquisitionPlaylist: 'Les analyses quantiques en vidéo',
    // Disclaimer propre à la fiche (≠ portefeuilles).
    disclaimer:
      'À titre informatif uniquement — ni conseil ni recommandation d’investissement. ' +
      'Données de clôture à J‑1, sans garantie d’exactitude.',
    // Horodatage.
    horodatagePrefix: 'Données du',
    horodatageSuffix: ', clôture US',
    // Accessibilité.
    ficheAria: 'Fiche société',
    lienFicheAria: 'Voir la fiche',
  },
  // Indice TQW (C3) — page /indice + carte d'accueil.
  // Le DOCUMENT de méthodologie n'est pas ici : il vit dans
  // docs/methodologie-indice-tqw.fr.md et est rendu tel quel (source unique,
  // aucune duplication possible). Seuls les libellés d'interface sont ici.
  indice: {
    nom: 'Indice TQW',
    // SEO — title.absolute (court-circuite le titleTemplate du layout).
    metaTitle: 'Indice TQW — l’indice des pure-players du quantique coté',
    soustitre:
      'L’indice propriétaire de The Quantum Wall — les pure-players du quantique coté, ' +
      'pondérés par capitalisation, plafonnés à 25 % par valeur, base 100 au 1er juin 2026.',
    retour: '← Accueil',
    chiffres: {
      valeur: 'Valeur de l’indice',
      jour: 'Var. jour',
      semaine: 'Var. semaine',
      mois: 'Var. mois',
      depuisInception: 'Depuis l’inception',
      constituants: 'Constituants',
    },
    // Graphique.
    chart: {
      titre: 'Performance — base 100',
      note:
        'Base 100 au 1er juin 2026 · Références en tirets : VanEck Quantum Computing UCITS ETF ' +
        '(QNTM.L) · Nasdaq-100 (QQQ). Les références servent de repère de marché — elles ne ' +
        'font pas partie de l’indice.',
      insuffisant: 'Historique insuffisant pour tracer une courbe.',
      series: {
        indice: 'Indice TQW',
        benchmark: 'VanEck UCITS',
        nasdaq100: 'Nasdaq-100',
      },
    },
    // Tableau des constituants — les DEUX colonnes de poids sont distinguées.
    constituants: {
      titre: 'Constituants et pondérations',
      colonnes: {
        societe: 'Société',
        ticker: 'Ticker',
        cours: 'Cours',
        capitalisation: 'Capitalisation',
        poidsRebalancement: 'Poids au rebalancement',
        poidsCourant: 'Poids courant',
        derive: 'Dérive',
      },
      // Explication de la distinction — affichée sous le tableau, pas en infobulle :
      // c'est la clé de lecture du tableau, elle doit être lisible sans interaction.
      explication:
        'Le poids au rebalancement est celui figé au {date}, plafond de 25 % appliqué. ' +
        'Le poids courant est celui qui résulte de l’évolution des cours depuis. ' +
        'L’écart entre les deux est normal : le plafond ne s’applique qu’au rebalancement, ' +
        'jamais en continu — un indice enregistre le marché, il ne le corrige pas.',
      plafonneeMarker: '▪',
      plafonneeTooltip: 'Écrêtée au plafond de 25 % lors du rebalancement.',
      derivePlafondMarker: '⚑',
      derivePlafondTooltip:
        'A dérivé au-dessus du plafond de 25 % depuis le rebalancement — normal entre deux ' +
        'rebalancements, sera réécrêtée au suivant.',
      total: 'Total',
      sourceActionsPrefix: 'Actions :',
    },
    // Méthodologie (document rendu).
    methodologie: {
      titre: 'Méthodologie',
      indisponible: 'Document de méthodologie momentanément indisponible.',
    },
    // Carte compacte sur l'accueil.
    carte: {
      titre: 'Indice TQW',
      accroche: 'L’indice des pure-players du quantique coté',
      lien: 'Voir l’indice',
      lienAria: 'Voir la page de l’Indice TQW',
      constituantsSuffixe: 'valeurs',
      depuisInception: 'depuis le 1er juin 2026',
    },
    navLabel: 'Indice',
    horodatagePrefix: 'Données du',
    horodatageSuffix: ', clôture US',
    disclaimer:
      'Indice informatif, non investissable — ni conseil ni recommandation d’investissement. ' +
      'Aucun produit financier ne le réplique. Données de clôture à J‑1, sans garantie d’exactitude.',
    indisponible:
      'L’indice n’est pas encore disponible. Il sera publié dès le premier calcul quotidien.',
    aria: {
      page: 'Indice TQW — indice des pure-players du quantique coté',
      chiffres: 'Chiffres clés de l’indice',
      carte: 'Indice TQW — valeur du jour',
    },
  },
  // Tableau comparatif des ETF quantiques /etf-quantiques + article /grille-etf.
  // Les DONNÉES des fonds vivent dans src/data/etf-quantiques.ts (contenu sourcé,
  // vérifié à la main) ; seuls les libellés d'interface sont ici.
  etf: {
    // SEO — title.absolute (court-circuite le titleTemplate du layout).
    metaTitle: 'ETF quantiques : le tableau comparatif complet (US, Europe, Asie) — The Quantum Wall',
    metaDescription:
      'ETF quantique : les dix fonds réellement dédiés à l’informatique quantique dans le monde, ' +
      'comparés sur l’accessibilité, l’encours, les frais et la composition. Chaque chiffre daté, ' +
      'sources primaires. Pour comprendre l’offre avant d’investir dans le quantique.',
    titre: 'ETF quantiques — le tableau comparatif',
    soustitre:
      'Dix fonds dans le monde sont réellement dédiés à l’informatique quantique — 2 aux États-Unis, ' +
      '3 en Europe, 5 en Corée du Sud. Tous les autres « ETF quantiques » des listes en ligne sont des ' +
      'fonds de semi-conducteurs, d’IA ou de robotique à exposition quantique marginale.',
    retour: '← Accueil',
    colonnes: {
      etf: 'ETF',
      ticker: 'Ticker · ISIN',
      bourse: 'Bourse',
      lancement: 'Lancement',
      encours: 'Encours',
      ter: 'Frais (TER)',
      composition: 'Type de composition',
      accessible: 'Accessible depuis l’Europe',
    },
    // Valeur non vérifiée : jamais de chiffre deviné, jamais de case vide muette.
    aVerifier: 'à vérifier',
    aVerifierTooltip:
      'Donnée non confirmée sur le document de l’émetteur — volontairement non affichée ' +
      'plutôt qu’estimée.',
    aRecouper: 'à recouper',
    aRecouperTooltip:
      'Chiffre relevé sur une source secondaire (agrégateur, presse), pas encore confirmé ' +
      'sur la page officielle de l’émetteur.',
    terAVerifierTooltip: 'Taux relevé sur l’émetteur, à revalider sur le document d’information clé en vigueur.',
    relevePrefix: 'relevé',
    accessibleOui: 'Oui',
    accessibleNon: 'Non',
    // Repère éditorial sur les 2 fonds comparés en détail dans la vidéo.
    sujetVideoMarker: '▪',
    sujetVideoNote:
      'Les deux lignes mises en évidence sont celles comparées en détail dans la vidéo. ' +
      'C’est un repère de lecture éditorial — ni conseil ni recommandation d’investissement.',
    // Section Corée — repliée par défaut (aucune n'est accessible depuis l'Europe).
    coreeSummary: '+ 5 ETF cotés en Corée du Sud, inaccessibles depuis l’Europe',
    coreeNote:
      'Tickers coréens relevés sur agrégateurs — à confirmer sur les fiches KRX. Les encours et ' +
      'frais des quatre fonds lancés en mars 2025 restent à recouper sur les pages officielles des émetteurs.',
    devisesNote:
      'Encours exprimés en dollars américains ($). Le TER est le total des frais annuels, en pourcentage ' +
      'de l’encours. Aucune conversion de devise n’est appliquée à l’affichage.',
    notesTitre: 'Notes de lecture',
    notes: [
      'Aucun fonds ne coche toutes les cases de la grille (majoritairement pure players + plus de ' +
        '100 M$ + accessible en Europe + frais contenus). Le WisdomTree est celui qui s’en approche ' +
        'le plus à ce jour ; il reste un panier hybride.',
      'Le cas WisdomTree : même stratégie, même nom, deux véhicules — un fonds US (CBOE) et un UCITS ' +
        'européen, aux compositions proches mais pas identiques (la version US affichait Quantinuum en ' +
        'première ligne à l’été 2026, la version UCITS D-Wave).',
      '3 fonds sont accessibles depuis l’Europe (VanEck, WisdomTree, iShares), tous au format UCITS, ' +
        'tous sur compte-titres, aucun éligible au PEA (règle des 75 % d’actions de sociétés UE, fonds ' +
        'majoritairement investis hors UE — inéligibilité confirmée explicitement sur les fiches émetteurs).',
      'Les deux fonds coréens « TOP10 » (Shinhan, Hanwha) sont les plus proches d’une exposition pure ' +
        'player concentrée — et ont logiquement affiché les plus fortes baisses du secteur sur l’été 2026, ' +
        'leurs 4 premières lignes pesant plus de la moitié du fonds. La concentration se paie dans les deux sens.',
      'Depuis le Canada ou la Suisse, l’accès est plus large : QTUM selon le courtier, et les UCITS ' +
        'VanEck et WisdomTree sont cotés sur SIX.',
    ] as readonly string[],
    // Encart d'appel à contribution — la vérification reste faite sur source primaire.
    signalementTitre: 'Un fonds manque à l’appel ?',
    signalementTexte:
      'Vous connaissez un ETF quantique qui n’est pas dans ce tableau ? Signalez-le en commentaire ' +
      'sous la vidéo — je vérifie sur source primaire et je l’ajoute.',
    signalementLien: 'Voir la vidéo sur L’Investisseuse Quantique ↗',
    // Liens croisés tableau ↔ article.
    versArticleTitre: 'La méthode derrière ce tableau',
    versArticleTexte:
      'Les cinq critères utilisés pour trier ces fonds — accessibilité, encours, frais, composition, ' +
      'indice suivi — sont détaillés dans l’article de méthode.',
    versArticleLien: 'Lire la grille des 5 critères →',
    // Lien contextuel depuis /indice, sous la note du graphique.
    versArticleLienDepuisIndice: 'Comparer les ETF quantiques du marché — tableau complet →',
    disclaimer:
      'À titre informatif uniquement — ni conseil ni recommandation d’investissement. Chaque chiffre ' +
      'porte sa date de relevé et vieillit : référez-vous aux pages officielles des émetteurs pour les ' +
      'données du jour. Positions détenues par l’autrice : IonQ, IBM, Alphabet, D-Wave, SEALSQ, IQM.',
    navLabel: 'ETF',
    aria: {
      page: 'ETF quantiques — tableau comparatif',
      tableau: 'Tableau comparatif des ETF quantiques accessibles ou cotés hors Corée',
      tableauCoree: 'ETF quantiques cotés en Corée du Sud',
      sujetVideo: 'Fonds comparé en détail dans la vidéo',
      videoLien: 'Vidéo sur la chaîne L’Investisseuse Quantique (nouvel onglet)',
    },
  },
  // Article de méthode /grille-etf — le TEXTE vit dans docs/grille-5-criteres-etf.fr.md
  // (source unique, versionnée, rendue telle quelle). Ici, l'habillage uniquement.
  grille: {
    metaTitle: 'Comment analyser un ETF quantique : la grille des 5 critères — The Quantum Wall',
    metaDescription:
      'ETF quantique : la grille des 5 critères à passer avant d’investir — accessibilité (UCITS, PEA), ' +
      'encours, frais, composition réelle et indice suivi. Méthode applicable à toute thématique, ' +
      'à partir de documents publics et gratuits.',
    retour: '← Accueil',
    indisponible: 'Article momentanément indisponible.',
    // Bouton de téléchargement — libellé imposé, identique sur les deux pages.
    pdfLabel: 'Télécharger la grille en PDF — gratuit, sans inscription',
    pdfHint: '1 page · à garder sous la main au moment de comparer',
    versTableauTitre: 'Le tableau comparatif',
    versTableauTexte:
      'Les dix ETF réellement dédiés au quantique dans le monde, passés à la grille des 5 critères, ' +
      'chaque chiffre daté.',
    versTableauLien: 'Voir le tableau comparatif complet →',
    videoLien: 'Voir la vidéo sur L’Investisseuse Quantique ↗',
    aria: {
      page: 'La grille des 5 critères — analyser un ETF thématique',
      article: 'Article — la grille des 5 critères',
    },
  },
  // Base d'événements sectoriels (C6) — frise sur les fiches sociétés.
  evenements: {
    titre: 'Événements',
    // Placeholder si aucun événement pour le ticker (le "Bientôt" reste).
    bientot: 'Frise chronologique des événements (contrats, dilutions, jalons) — bientôt.',
    sourcePrefix: 'Source :',
    // Marqueur discret sur un événement dont la date est postérieure à aujourd'hui.
    aVenir: 'À venir',
    aria: {
      frise: 'Frise chronologique des événements',
      lienSource: 'Ouvrir la source (nouvel onglet)',
      aVenir: 'Événement à venir',
    },
    // Libellés des types — miroir de la liste fermée (CHECK migration 008).
    types: {
      ipo: 'IPO',
      spac: 'SPAC',
      reverse_split: 'Reverse split',
      dilution: 'Dilution',
      contrat: 'Contrat',
      resultats: 'Résultats',
      acquisition: 'Acquisition',
      reglementaire: 'Réglementaire',
      technologie: 'Technologie',
      autre: 'Autre',
    } as Record<string, string>,
  },
} as const

// Notes de bas de tableau par ticker — marqueur exposant + texte de note.
// Ajouter ici tout ticker nécessitant une nuance éditoriale importante.
export const TICKER_NOTES: Record<string, { marker: string; text: string }> = {
  QNT:  {
    marker: '*',
    text: 'pleinement diluée — structure Up-C, flottant Class A ≈ 10 %',
  },
  ARQQ: {
    marker: '†',
    text: 'profil à risque élevé — reverse split 25:1 (sept. 2024) pour conformité Nasdaq, voir analyse quantum washing',
  },
  IQMX: {
    marker: '§',
    text:
      "cotée depuis le 2 juillet 2026 (fusion SPAC) — capitalisation sur le total des actions et votes " +
      "au registre finlandais, et non sur le flottant. P/S estimé à partir du chiffre d'affaires de " +
      "l'exercice 2025 converti d'euros en dollars : ce n'est pas un TTM et il n'est pas recoupable",
  },
}

// URL de la vidéo dédiée à chaque société sur L'Investisseuse Quantique, ciblée
// depuis la ligne d'acquisition des fiches (/societe/[ticker]).
// Un ticker qui pointe vers VIDEO_PLAYLIST_URL n'a pas encore de vidéo dédiée :
// pour en câbler une, il suffit de remplacer cette seule ligne par l'URL de la
// vidéo (candidats à venir : QNT, HQ, ARQQ). Le libellé s'adapte automatiquement
// (vidéo dédiée → t.societe.acquisitionDediee ; playlist → acquisitionPlaylist).
export const VIDEO_PLAYLIST_URL =
  'https://www.youtube.com/playlist?list=PLAn58cjygWQqLv2rnAIxck_JBIwXh8D6a'

export const TICKER_VIDEO_URL: Record<string, string> = {
  GOOGL: 'https://youtu.be/hJcJA4n0Bwc',
  IBM:   'https://youtu.be/hJcJA4n0Bwc', // même vidéo que GOOGL — voulu
  IONQ:  'https://www.youtube.com/watch?v=I-ZZnWBRz9c',
  QBTS:  'https://youtu.be/ApQvvicBjTk',
  RGTI:  'https://youtu.be/U1xAUb8d5RA',
  IQMX:  'https://youtu.be/h_p7IiXSRsI',
  LAES:  'https://youtu.be/HdhxkfJQn3c',
  QNT:   VIDEO_PLAYLIST_URL,
  INFQ:  VIDEO_PLAYLIST_URL,
  QUBT:  VIDEO_PLAYLIST_URL,
  XNDU:  VIDEO_PLAYLIST_URL,
  HQ:    VIDEO_PLAYLIST_URL,
  ARQQ:  VIDEO_PLAYLIST_URL,
}

// Modalités technologiques par ticker — badge affiché après le nom de société.
// N'ajouter que lorsque la modalité est distincte du reste du panel (valeur éditoriale).
export const TICKER_MODALITIES: Record<string, string> = {
  XNDU: 'photonique',
  IQMX: 'supraconducteur',
}
