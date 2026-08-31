/**
 * D4 — règles d'AFFICHAGE du tableau des capitalisations, en un seul endroit.
 *
 * Depuis D4 le tableau existe en deux rendus : le `<table>` desktop et les
 * fiches dépliables mobile. Les deux disent les mêmes chiffres, avec les mêmes
 * marqueurs et les mêmes avertissements — mais dans des éléments différents
 * (`<td title="…">` d'un côté, texte visible de l'autre : le survol n'existe
 * pas sur tactile).
 *
 * Ces helpers sont PURS : ils décident quoi dire, jamais comment le baliser.
 * Sans eux, la vue mobile aurait été une deuxième copie des règles P/S et de
 * fraîcheur — exactement la divergence que la centralisation de `isStale`
 * (C7, src/lib/dilution.ts) a été écrite pour empêcher. Une seule source, deux
 * rendus : si un seuil bouge, il bouge des deux côtés par construction.
 */

import type { MarketCapRow } from '@/lib/api';
import { formatDateCompact, formatMarketCap, formatRatio } from '@/lib/format';
import { t } from '@/i18n/t';
import { isStale } from '@/lib/dilution';

/**
 * Ratio P/S — affichage à DEUX niveaux (S-P/S). Les deux marqueurs sont de
 * nature distincte et ne doivent jamais se confondre :
 *   ⚠ = données fiables mais valorisation extrême
 *   ‡ = données incertaines (CA partiel ou non recoupé)
 * Un P/S ferme normal ne porte AUCUN marqueur.
 */
export type PsMarkerKind = 'extreme' | 'uncertain' | 'insignificant' | null;

export type PsPresentation = {
  /** Valeur à afficher : le ratio formaté, « n.s. » ou « — ». */
  text: string;
  /** Glyphe accolé à la valeur, ou null. */
  marker: string | null;
  markerKind: PsMarkerKind;
  /** Explication — rendue en `title=` sur desktop, en texte visible sur mobile. */
  note: string | null;
};

export function psPresentation(row: MarketCapRow): PsPresentation {
  switch (row.ps_status) {
    case 'none':
      return { text: '—', marker: null, markerKind: null, note: null };
    case 'insignificant':
      return {
        text: t.secteur.ps.insignifiant,
        marker: null,
        markerKind: 'insignificant',
        note: t.secteur.ps.insignifiantTooltip,
      };
    case 'firm':
      return { text: formatRatio(row.ps_ratio), marker: null, markerKind: null, note: null };
    case 'firm_extreme':
      return {
        text: formatRatio(row.ps_ratio),
        marker: t.secteur.ps.extremeMarker,
        markerKind: 'extreme',
        note: t.secteur.ps.extremeTooltip,
      };
    case 'partial':
      return {
        text: formatRatio(row.ps_ratio),
        marker: t.secteur.ps.incertainMarker,
        markerKind: 'uncertain',
        note: t.secteur.ps.partielTooltip,
      };
    case 'unrecouped':
      return {
        text: formatRatio(row.ps_ratio),
        marker: t.secteur.ps.incertainMarker,
        markerKind: 'uncertain',
        note: t.secteur.ps.nonRecoupeTooltip,
      };
  }
}

/** Sens d'une variation — `null` quand elle n'est pas calculable (IPO récente). */
export function changeTone(value: number | null): 'pos' | 'neg' | null {
  if (value == null) return null;
  return value >= 0 ? 'pos' : 'neg';
}

/**
 * Fraîcheur du nombre d'actions. Le ⚠ et son explication sont IDENTIQUES au
 * seuil des liquidités (C7) et de l'en-tête de fiche : `isStale`, 150 jours.
 * Sur desktop la note part en infobulle de la capitalisation ; sur mobile elle
 * s'affiche en clair sous le nombre d'actions.
 */
export function sharesFreshness(row: MarketCapRow): { stale: boolean; note: string } {
  // Aucun décompte d'actions publié : ce n'est PAS un problème de fraîcheur mais
  // une absence de donnée. Les deux ne se signalent pas pareil — un ⚠ « donnée
  // ancienne » sur une donnée qui n'existe pas induirait en erreur.
  if (row.shares_date == null) return { stale: false, note: '' };
  const stale = isStale(row.shares_date);
  const note =
    `${t.secteur.actionsTooltip} ${formatDateCompact(row.shares_date)}` +
    (stale ? ` ${t.secteur.actionsTooltipStale}` : '');
  return { stale, note };
}

/**
 * Capitalisation — présentation. `null` signifie « aucun dépôt ne publie encore
 * le décompte d'actions », jamais « zéro » ni « à venir ». La ligne reste
 * affichée et porte son explication : signaler sans masquer.
 */
export type MarketCapPresentation = {
  text: string;
  /** Marqueur accolé à la valeur quand la capitalisation est indisponible. */
  marker: string | null;
  /** Explication — `title=` sur desktop, texte visible sur mobile. */
  note: string | null;
  available: boolean;
};

export function marketCapPresentation(row: MarketCapRow): MarketCapPresentation {
  if (row.market_cap_usd == null) {
    return {
      text: '—',
      marker: t.secteur.capiIndisponible.marker,
      note: t.secteur.capiIndisponible.note,
      available: false,
    };
  }
  const { note } = sharesFreshness(row);
  return { text: formatMarketCap(row.market_cap_usd), marker: null, note, available: true };
}
