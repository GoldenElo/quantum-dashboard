// ETF réellement dédiés à l'informatique quantique — données éditoriales.
//
// PAS de table Supabase : ces valeurs bougent rarement et sont mises à jour
// À LA MAIN, après vérification sur source primaire (page émetteur, DIC, fiche
// KRX). Une table impliquerait un cron, donc une source automatisée — il n'en
// existe aucune de fiable pour l'encours d'un ETF.
//
// RÈGLE DE DONNÉES NON NÉGOCIABLE (héritée du Wall) : aucun chiffre sans date.
// Elle est ici garantie PAR LE COMPILATEUR (voir le type `Encours` ci-dessous) :
// écrire un encours sans sa date de relevé ne compile pas.
// Un champ dont la valeur n'est pas vérifiée reste ABSENT — l'affichage montre
// alors « à vérifier ». Ne jamais combler un trou par une estimation.
//
// Source de vérification et checklist : docs/sources/tableau-etf-quantiques.md

export type EtfRegion = 'US' | 'Europe' | 'Corée';

// Un encours est indissociable de sa date de relevé : les deux champs vont
// ensemble, ou aucun des deux. C'est la règle « pas de date, pas de chiffre »
// exprimée dans le système de types plutôt qu'en commentaire.
type Encours =
  | {
      /** Encours (actifs sous gestion) en MILLIONS de dollars américains. */
      encoursMusd: number;
      /** Date de relevé : ISO (`2026-08-04`) si le jour est connu, sinon libellé (`mi-2026`). */
      encoursDate: string;
      /** L'émetteur ou la source ne donne qu'un ordre de grandeur → affiché avec « ~ ». */
      encoursApprox?: boolean;
      /** Chiffre relevé sur une source secondaire → badge « à recouper ». */
      encoursARecouper?: boolean;
    }
  | { encoursMusd?: never; encoursDate?: never; encoursApprox?: never; encoursARecouper?: never };

export type EtfQuantique = {
  nom: string;
  ticker: string;
  /** Présent pour les UCITS — c'est l'ISIN qui prouve l'accessibilité européenne. */
  isin?: string;
  bourse: string;
  region: EtfRegion;
  /** Mois de lancement, tel que publié (`mai 2025`). */
  lancement: string;
  /** Frais annuels totaux, en pourcentage (0.55 = 0,55 %/an). Absent = à vérifier. */
  terPct?: number;
  /** Valeur relevée mais non revalidée sur le document émetteur. */
  terAVerifier?: boolean;
  /** Phrase courte — nature du panier, pas un jugement. */
  composition: string;
  accessibleEurope: boolean;
  accessibleEuropeNote?: string;
  /** Fonds comparés en détail dans la vidéo — mise en évidence ÉDITORIALE, jamais un conseil. */
  sujetVideo?: boolean;
} & Encours;

// Ordre d'affichage volontaire : US puis Europe (les 5 fonds accessibles ou
// notoires), la Corée est une section repliée à part.
export const ETF_QUANTIQUES: EtfQuantique[] = [
  {
    nom: 'Defiance Quantum ETF',
    ticker: 'QTUM',
    bourse: 'NYSE Arca',
    region: 'US',
    lancement: 'sept. 2018',
    encoursMusd: 5600,
    encoursDate: 'mi-2026',
    encoursApprox: true,
    terPct: 0.40,
    composition: 'Hybride large — semi-conducteurs, défense, quantique',
    accessibleEurope: false,
    accessibleEuropeNote: 'pas de version UCITS',
  },
  {
    nom: 'WisdomTree Quantum Computing Fund (version US)',
    ticker: 'WQTM',
    bourse: 'CBOE',
    region: 'US',
    lancement: 'déc. 2025',
    encoursMusd: 329,
    encoursDate: 'août 2026',
    encoursApprox: true,
    terPct: 0.45,
    terAVerifier: true,
    composition: 'Dominante pure players — Quantinuum, D-Wave, Rigetti, IonQ en tête',
    accessibleEurope: false,
    accessibleEuropeNote: 'son jumeau UCITS figure ci-dessous',
  },
  {
    nom: 'VanEck Quantum Computing UCITS',
    ticker: 'QNTM',
    // ISIN confirmé sur le KIID officiel VanEck (2026-08-06). C'est le même fonds
    // que le benchmark QNTM.L des graphiques — un seul ISIN fait foi dans le repo.
    isin: 'IE0007Y8Y157',
    bourse: 'Euronext · Xetra · LSE · SIX',
    region: 'Europe',
    lancement: 'mai 2025',
    encoursMusd: 871,
    encoursDate: '2026-06-19',
    terPct: 0.55,
    composition: 'Hybride ~30 valeurs — pure players + géants sélectionnés sur brevets',
    accessibleEurope: true,
    accessibleEuropeNote: 'CTO, pas de PEA',
    sujetVideo: true,
  },
  {
    nom: 'WisdomTree Quantum Computing UCITS',
    ticker: 'WQTM',
    isin: 'IE000W8WMSL2',
    bourse: 'Euronext Paris · LSE · Xetra · SIX',
    region: 'Europe',
    lancement: 'août 2025',
    encoursMusd: 359,
    encoursDate: '2026-08-04',
    terPct: 0.50,
    composition: 'Hybride à dominante pure players — D-Wave, Rigetti, IonQ en tête, plafond 15 %',
    accessibleEurope: true,
    accessibleEuropeNote: 'CTO, pas de PEA',
    sujetVideo: true,
  },
  {
    nom: 'iShares Quantum Computing UCITS',
    ticker: 'QANT',
    isin: 'IE000C6ITGC8',
    bourse: 'Euronext · Xetra',
    region: 'Europe',
    lancement: 'déc. 2025',
    encoursMusd: 64,
    encoursDate: '2026-07-29',
    terPct: 0.50,
    composition: 'Hybride ~30 valeurs — score thématique STOXX',
    accessibleEurope: true,
    accessibleEuropeNote: 'CTO, pas de PEA',
  },
  {
    nom: 'Kiwoom KOSEF US Quantum Computing',
    ticker: '498270',
    bourse: 'KRX',
    region: 'Corée',
    lancement: 'déc. 2024',
    // ~180 M$ converti de 262,94 Md KRW — cours et conversion à actualiser.
    encoursMusd: 180,
    encoursDate: 'janvier 2026',
    encoursApprox: true,
    encoursARecouper: true,
    terPct: 0.49,
    composition: 'Hybride ~20 valeurs US — Alphabet en tête',
    accessibleEurope: false,
  },
  {
    nom: 'SamsungActive KoAct Global Quantum Active',
    ticker: '0020H0',
    bourse: 'KRX',
    region: 'Corée',
    lancement: 'mars 2025',
    terPct: 0.50,
    composition: 'Actif, global — US, Japon, Corée, semi-conducteurs asiatiques',
    accessibleEurope: false,
  },
  {
    nom: 'KB RISE US Quantum Computing',
    ticker: '0018Z0',
    bourse: 'KRX',
    region: 'Corée',
    lancement: 'mars 2025',
    composition: 'Hybride — grandes capitalisations tech en amortisseur',
    accessibleEurope: false,
  },
  {
    nom: 'Shinhan SOL US Quantum Computing TOP10',
    ticker: '0023A0',
    bourse: 'KRX',
    region: 'Corée',
    lancement: 'mars 2025',
    composition: 'Concentré 10 valeurs — pure players dominants',
    accessibleEurope: false,
  },
  {
    nom: 'Hanwha PLUS US Quantum Computing TOP10',
    ticker: '0023B0',
    bourse: 'KRX',
    region: 'Corée',
    lancement: 'mars 2025',
    composition: 'Concentré 10 valeurs — pure players dominants',
    accessibleEurope: false,
  },
];

export const ETF_HORS_COREE = ETF_QUANTIQUES.filter(e => e.region !== 'Corée');
export const ETF_COREE = ETF_QUANTIQUES.filter(e => e.region === 'Corée');
