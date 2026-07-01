export const fr = {
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
}

// Modalités technologiques par ticker — badge affiché après le nom de société.
// N'ajouter que lorsque la modalité est distincte du reste du panel (valeur éditoriale).
export const TICKER_MODALITIES: Record<string, string> = {
  XNDU: 'photonique',
}
