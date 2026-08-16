/**
 * C7 — calculs de dilution et mise en forme du runway.
 *
 * MIROIR EXACT de `scripts/check_dilution.py`. Les deux implémentations doivent
 * dire la même chose : le tableau de contrôle perdrait son sens s'il validait
 * des chiffres que la fiche présente autrement. Toute modification ici en appelle
 * une là-bas, et réciproquement — les constantes portent le même nom des deux
 * côtés pour rendre l'écart visible en revue.
 *
 * Rien n'est stocké de ce qui est calculé ici : la dilution se déduit de
 * `shares_outstanding`, le runway de `company_financials`. Principe constant du
 * projet, déjà appliqué à la capitalisation (S1), aux variations (S2) et au P/S.
 */

const DAYS_PER_YEAR = 365.25;
const MS_PER_DAY = 1000 * 60 * 60 * 24;

/**
 * Seuil « données anciennes » — 150 j ≈ 5 mois.
 *
 * SOURCE UNIQUE du projet. Le tableau des capitalisations (S1) et l'en-tête de
 * fiche portaient chacun leur propre copie de cette constante ; une troisième
 * pour les liquidités aurait garanti la divergence. Même seuil, même marqueur ⚠,
 * quelle que soit la ligne regardée.
 */
export const STALE_MS = MS_PER_DAY * 150;

export function isStale(dateStr: string | null | undefined): boolean {
  if (!dateStr) return false;
  const [y, m, d] = dateStr.split('-').map(Number);
  return Date.now() - new Date(y, m - 1, d).getTime() > STALE_MS;
}

/**
 * Au-delà de 9 mois, aucune projection. Le relevé reste affiché avec sa date,
 * le runway disparaît — il n'est pas dégradé, il est supprimé. Cas ARQQ, arrêté
 * au 31/03/2025 : projeter une consommation sur des liquidités vieilles de
 * 17 mois serait une invention, pas une approximation.
 */
export const NO_RUNWAY_MS = MS_PER_DAY * 270;

export function tooOldForRunway(dateStr: string | null | undefined): boolean {
  if (!dateStr) return true;
  const [y, m, d] = dateStr.split('-').map(Number);
  return Date.now() - new Date(y, m - 1, d).getTime() > NO_RUNWAY_MS;
}

/**
 * Plafond d'affichage du runway. « ~112 trimestres » (QUBT) est exact et
 * illisible : personne ne pilote une trésorerie à 28 ans, et le chiffre donne
 * une fausse impression de précision sur une projection qui supposerait la
 * consommation actuelle constante pendant trois décennies.
 */
export const RUNWAY_CAP_QUARTERS = 20;

/**
 * Au-delà de ce rythme, ce n'est plus de la dilution mais un changement de BASE
 * DE MESURE. Cas QNT : le relevé yfinance (31,4 M, flottant Class A seul) suivi
 * de la surcharge 424B4 (322 M, Up-C) donnait +39 572 938 %/an. Les deux chiffres
 * sont justes et ne mesurent pas la même chose ; les enchaîner produit une
 * absurdité. On coupe la série à la rupture au lieu de moyenner par-dessus.
 */
export const BASIS_BREAK_RATE = 20; // +2 000 %/an

/** Fenêtre acceptable pour un « 12 mois glissants » bâti sur des points annuels. */
const TTM_MIN_DAYS = 180;
const TTM_MAX_DAYS = 550;

export type SharePoint = { date: string; shares: number; source: string };

function daysBetween(a: string, b: string): number {
  return (Date.parse(b) - Date.parse(a)) / MS_PER_DAY;
}

function stepRate(a: SharePoint, b: SharePoint): number | null {
  const days = daysBetween(a.date, b.date);
  if (days <= 0 || a.shares <= 0) return null;
  return Math.pow(b.shares / a.shares, DAYS_PER_YEAR / days) - 1;
}

/**
 * Ne conserve que le dernier segment de relevés COMPARABLES entre eux, et
 * retourne les ruptures détectées — jamais de coupe silencieuse.
 */
export function comparableSegment(points: SharePoint[]): {
  series: SharePoint[];
  breaks: { from: SharePoint; to: SharePoint; rate: number }[];
} {
  const breaks: { from: SharePoint; to: SharePoint; rate: number }[] = [];
  let cut = 0;
  for (let i = 1; i < points.length; i++) {
    const rate = stepRate(points[i - 1], points[i]);
    if (rate !== null && Math.abs(rate) > BASIS_BREAK_RATE) {
      breaks.push({ from: points[i - 1], to: points[i], rate });
      cut = i;
    }
  }
  return { series: points.slice(cut), breaks };
}

/** Taux annualisé sur toute la série, et nombre d'années couvertes. */
export function annualizedDilution(points: SharePoint[]): { rate: number; years: number } | null {
  if (points.length < 2) return null;
  const first = points[0];
  const last = points[points.length - 1];
  const days = daysBetween(first.date, last.date);
  if (days <= 0 || first.shares <= 0) return null;
  const years = days / DAYS_PER_YEAR;
  return { rate: Math.pow(last.shares / first.shares, 1 / years) - 1, years };
}

/**
 * Rythme récent : dernier relevé vs le plus proche d'un an en arrière, annualisé
 * sur l'écart RÉEL. Le point de départ retenu est retourné pour que la fenêtre
 * effectivement utilisée soit affichée — un « 12 mois » calculé sur 15 mois doit
 * le dire.
 */
export function ttmDilution(points: SharePoint[]): { rate: number; from: SharePoint; days: number } | null {
  if (points.length < 2) return null;
  const last = points[points.length - 1];
  const candidates = points.slice(0, -1).filter(p => {
    const d = daysBetween(p.date, last.date);
    return d >= TTM_MIN_DAYS && d <= TTM_MAX_DAYS && p.shares > 0;
  });
  if (candidates.length === 0) return null;
  const target = DAYS_PER_YEAR;
  const best = candidates.reduce((a, b) =>
    Math.abs(daysBetween(b.date, last.date) - target) < Math.abs(daysBetween(a.date, last.date) - target) ? b : a
  );
  const rate = stepRate(best, last);
  if (rate === null) return null;
  return { rate, from: best, days: Math.round(daysBetween(best.date, last.date)) };
}

/**
 * Runway en trimestres — null dès qu'une des conditions de publication manque.
 * Le blocage à ±10 % du communiqué est appliqué EN AMONT, à l'écriture
 * (`fetch_financials.py`) : une ligne non recoupée n'arrive jamais jusqu'ici.
 */
export function runwayQuarters(
  liquidity: number | null,
  burnPerQuarter: number | null,
  asOf: string | null
): number | null {
  if (liquidity == null || burnPerQuarter == null || burnPerQuarter >= 0) return null;
  if (tooOldForRunway(asOf)) return null;
  return liquidity / Math.abs(burnPerQuarter);
}
