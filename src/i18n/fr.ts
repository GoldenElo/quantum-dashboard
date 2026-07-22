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
    acquisition: "L’analyse en vidéo sur L’Investisseuse Quantique",
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
  // Base d'événements sectoriels (C6) — frise sur les fiches sociétés.
  evenements: {
    titre: 'Événements',
    // Placeholder si aucun événement pour le ticker (le "Bientôt" reste).
    bientot: 'Frise chronologique des événements (contrats, dilutions, jalons) — bientôt.',
    sourcePrefix: 'Source :',
    aria: {
      frise: 'Frise chronologique des événements',
      lienSource: 'Ouvrir la source (nouvel onglet)',
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

// Modalités technologiques par ticker — badge affiché après le nom de société.
// N'ajouter que lorsque la modalité est distincte du reste du panel (valeur éditoriale).
export const TICKER_MODALITIES: Record<string, string> = {
  XNDU: 'photonique',
  IQMX: 'supraconducteur',
}
