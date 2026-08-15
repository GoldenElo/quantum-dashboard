/**
 * D3 — Mode sombre. SOURCE UNIQUE de la charte graphique (clair ET sombre).
 *
 * Pourquoi ici et pas dans `globals.css` : les graphiques (Recharts, treemap SVG)
 * reçoivent leurs couleurs en props JavaScript — ils ne savent pas lire
 * `var(--token)`. Deux jeux de valeurs tenus à la main divergent toujours à terme.
 * On inverse donc la dépendance : les valeurs vivent ici, typées, et le bloc
 * `:root { … }` est GÉNÉRÉ depuis ce fichier (`buildThemeCss()`, injecté par le
 * layout). `globals.css` ne contient plus aucune valeur de couleur, seulement des
 * `var(--token)`. Une couleur n'est donc écrite qu'une fois, dans ce fichier.
 *
 * Contrastes WCAG vérifiés sur le fond sombre #0e1420 avant écriture :
 * texte 15,7:1 · atténué 7,2:1 · teal 9,9:1 · or 9,3:1 · positif 9,6:1 ·
 * négatif 6,7:1 · personnel 8,1:1 — toutes les séries de graphiques ≥ 4,5:1.
 */

export type ThemeMode = 'light' | 'dark';

/** Clé localStorage du choix manuel. Absente = c'est l'OS qui décide. */
export const THEME_STORAGE_KEY = 'tqw-theme';

/* ────────────────────────── Jetons d'interface ──────────────────────────── */

/**
 * Charte CLAIRE — presse financière, fond blanc. Valeurs historiques inchangées.
 * Les clés sont les noms des variables CSS (sans le `--`).
 */
const LIGHT = {
  'bg-page': '#ffffff',
  'bg-panel': '#f5f7fa',
  'border': '#e6e9ee',
  // Teal foncé — accent principal, liens, texte accentué.
  'accent-blue': '#0d9488',
  'accent-blue-hover': '#0b7d73',
  // Aplats pleins (boutons, pastilles de nav) + leur couleur de texte.
  'accent-fill': '#0d9488',
  'accent-fill-text': '#ffffff',
  'accent-fill-hover': '#0b7d73',
  // Teal vif — aplats/badges UNIQUEMENT, jamais du texte (règle de charte).
  'cyan': '#34d1c4',
  'or': '#b8943a',
  'personal': '#c2410c',
  'text': '#0c1d38',
  'text-muted': '#5a6b82',
  'positive': '#15803d',
  'negative': '#dc2626',
  // Fond des infobulles de graphique : au-dessus des panneaux, jamais confondu.
  'tooltip-bg': '#ffffff',
} as const;

/**
 * Charte SOMBRE — « terminal de marché ». Fond bleu-gris profond, jamais noir pur.
 *
 * RÈGLE DURE : ce n'est PAS la charte claire sur fond sombre. Les tons foncés
 * (teal #0d9488, or #b8943a, vert #15803d) sont calibrés pour le blanc et
 * deviennent illisibles ici — chaque couleur d'accent est ÉCLAIRCIE, et le
 * contraste revérifié. Les aplats s'inversent : fond teal clair, texte sombre.
 */
const DARK = {
  'bg-page': '#0e1420',
  'bg-panel': '#161e2e',
  'border': '#263145',
  'accent-blue': '#2dd4bf',
  'accent-blue-hover': '#5eead4',
  'accent-fill': '#2dd4bf',
  'accent-fill-text': '#0b1220',
  'accent-fill-hover': '#5eead4',
  'cyan': '#34d1c4',
  'or': '#d9b45c',
  'personal': '#fb923c',
  'text': '#e8edf5',
  'text-muted': '#93a3ba',
  'positive': '#34d399',
  'negative': '#f87171',
  'tooltip-bg': '#1c2739',
} as const;

export const UI_TOKENS: Record<ThemeMode, Record<keyof typeof LIGHT, string>> = {
  light: LIGHT,
  dark: DARK,
};

/* ────────────────────── Séries des graphiques ───────────────────────────── */

export type SeriesKey =
  | 'defensif' | 'dynamique' | 'agressif' | 'personnel'
  | 'benchmark' | 'nasdaq100' | 'indice' | 'capitalisation';

/**
 * Couleurs de séries. Celles qui coïncident avec un jeton d'interface le
 * RÉFÉRENCENT (pas de valeur recopiée) : `dynamique` EST le teal d'accent,
 * `personnel` EST la couleur réservée du portefeuille personnel.
 */
export const SERIES_COLORS: Record<ThemeMode, Record<SeriesKey, string>> = {
  light: {
    defensif: '#2563EB',
    dynamique: LIGHT['accent-blue'],
    agressif: '#7C3AED',
    personnel: LIGHT.personal,
    benchmark: LIGHT['text-muted'],
    nasdaq100: '#8099B3', // étalon marché — volontairement en retrait
    indice: LIGHT['accent-blue'],
    capitalisation: LIGHT['accent-blue'],
  },
  dark: {
    defensif: '#60a5fa',
    dynamique: DARK['accent-blue'],
    agressif: '#a78bfa',
    personnel: DARK.personal,
    benchmark: DARK['text-muted'],
    nasdaq100: '#6b7f96',
    indice: DARK['accent-blue'],
    capitalisation: DARK['accent-blue'],
  },
};

/** Les trois profils portent aussi un badge en CSS → exposés en variables. */
const SERIES_CSS_VARS: SeriesKey[] = ['defensif', 'dynamique', 'agressif'];

/* ─────────────────── Habillage des graphiques (dérivé) ──────────────────── */

export type ChartChrome = {
  grid: string;
  axis: string;
  tooltipBg: string;
  tooltipBorder: string;
  tooltipLabel: string;
  legend: string;
};

/** DÉRIVÉ des jetons — aucune couleur nouvelle, donc aucune dérive possible. */
function chromeFor(mode: ThemeMode): ChartChrome {
  const c = UI_TOKENS[mode];
  return {
    grid: c.border,
    axis: c['text-muted'],
    tooltipBg: c['tooltip-bg'],
    tooltipBorder: c.border,
    tooltipLabel: c.text,
    legend: c['text-muted'],
  };
}

export const CHART_CHROME: Record<ThemeMode, ChartChrome> = {
  light: chromeFor('light'),
  dark: chromeFor('dark'),
};

/* ───────────────────── Camemberts d'allocation ──────────────────────────── */

/** Une couleur par ticker — aucun usage CSS, donc pas de variable exposée. */
export const PIE_COLORS: Record<ThemeMode, Record<string, string>> = {
  light: {
    GOOGL: '#1d4ed8', IBM: '#4338ca', NVDA: '#059669',
    IONQ: '#0891b2', QBTS: '#be185d', LAES: '#d97706', INFQ: '#7c3aed',
  },
  dark: {
    GOOGL: '#60a5fa', IBM: '#8b8cf7', NVDA: '#34d399',
    IONQ: '#38bdf8', QBTS: '#f472b6', LAES: '#fbbf24', INFQ: '#a78bfa',
  },
};

export const PIE_FALLBACK: Record<ThemeMode, string> = {
  light: '#6b7280',
  dark: '#94a3b8',
};

/* ──────────────────────── Treemap du Mur ────────────────────────────────── */

/**
 * Échelle divergente de la treemap. Les extrémités sont interpolées en RGB
 * numérique — d'où des triplets et non des chaînes.
 *
 * RÈGLE (mode sombre) : extrémités rouge/vert PROFONDES, jamais vives. Le texte
 * des tuiles reste alors clair sur toute la rampe (pire contraste mesuré 6,1:1).
 * Des extrémités vives créeraient une zone médiane où ni le texte clair ni le
 * texte foncé n'atteint 4,5:1 — un dégradé joli et illisible.
 */
export type TreemapPalette = {
  neg: [number, number, number];
  pos: [number, number, number];
  neutral: [number, number, number];
  nul: string;      // variation non calculable
  textOnNul: string; // texte lisible sur cette tuile-là
  stroke: string;   // séparation entre tuiles
  textDark: string;
  textLight: string;
};

export const TREEMAP: Record<ThemeMode, TreemapPalette> = {
  light: {
    neg: [220, 38, 38],       // #dc2626 = --negative
    pos: [21, 128, 61],       // #15803d = --positive
    neutral: [238, 241, 245], // #eef1f5 ≈ --bg-panel (volontairement stable)
    nul: '#dde3ea',
    textOnNul: LIGHT.text,
    stroke: '#ffffff',
    textDark: LIGHT.text,
    textLight: '#ffffff',
  },
  dark: {
    neg: [161, 29, 29],       // #a11d1d rouge profond
    pos: [22, 101, 52],       // #166534 vert profond
    neutral: [28, 39, 57],    // #1c2739 — au-dessus du panneau : une tuile reste une tuile
    nul: '#232d3f',
    textOnNul: DARK.text,
    stroke: DARK['bg-page'],
    textDark: '#0b1220',
    textLight: DARK.text,
  },
};

/** `rgb(…)` prêt à l'emploi — légende de la treemap, rendue en style inline. */
export const rgbOf = (c: [number, number, number]) => `rgb(${c[0]}, ${c[1]}, ${c[2]})`;

/* ──────────────────── Génération du CSS + amorçage ──────────────────────── */

const declarations = (mode: ThemeMode): string =>
  [
    ...Object.entries(UI_TOKENS[mode]).map(([k, v]) => `--${k}:${v}`),
    ...SERIES_CSS_VARS.map(k => `--serie-${k}:${SERIES_COLORS[mode][k]}`),
    `color-scheme:${mode}`,
  ].join(';');

/**
 * Bloc `:root` injecté dans le document par le layout.
 *
 * Trois déclarations, dans cet ordre :
 *  1. `:root` — la charte claire, socle par défaut ;
 *  2. la préférence système, neutralisée si un choix manuel « clair » est posé ;
 *  3. l'attribut explicite, qui prime dans les deux sens (le choix manuel gagne).
 */
export function buildThemeCss(): string {
  return [
    `:root{${declarations('light')}}`,
    `@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){${declarations('dark')}}}`,
    `:root[data-theme="dark"]{${declarations('dark')}}`,
  ].join('');
}

/**
 * Script exécuté AVANT le premier paint (premier enfant de `<body>`) — sans lui,
 * le navigateur peint le blanc du CSS par défaut puis bascule : le flash blanc
 * est le piège classique du mode sombre. Le `catch` retombe sur la préférence OS,
 * et l'attribut est posé DANS TOUS LES CAS pour que le CSS n'ait jamais à deviner.
 */
export const THEME_INIT_SCRIPT = `(function(){var m="light";try{var s=localStorage.getItem("${THEME_STORAGE_KEY}");if(s==="light"||s==="dark"){m=s}else if(window.matchMedia("(prefers-color-scheme: dark)").matches){m="dark"}}catch(e){try{if(window.matchMedia("(prefers-color-scheme: dark)").matches){m="dark"}}catch(e2){}}document.documentElement.setAttribute("data-theme",m)})();`;
