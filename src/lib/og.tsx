import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { t } from '@/i18n/t';
import { formatDate } from '@/lib/format';

/**
 * Socle partagé des images Open Graph (C4).
 *
 * Trois templates (accueil / fiche société / indice) partagent ce cadre pour que
 * tout partage social soit reconnaissable au premier coup d'œil : même bandeau de
 * marque, même horodatage, même pied. Contraintes de la brique :
 *
 * - **Lisibilité en miniature d'abord.** X/LinkedIn affichent la carte à ~300 px de
 *   large : les chiffres sont gros, le texte rare. Tout libellé sous 20 px à l'échelle
 *   1200×630 devient illisible une fois réduit — c'est le plancher, pas une préférence.
 * - **Charte claire** (fond blanc, navy, teal, or). Les tokens CSS de globals.css ne
 *   sont PAS résolus par satori : la palette est dupliquée ci-dessous en littéral.
 *   Toute évolution de la charte doit toucher les DEUX endroits.
 * - **Date des données visible sur chaque image** : une carte partagée sans date est
 *   un chiffre sans contexte, qui vieillit en silence. Non négociable.
 * - **Runtime Node** (pas edge) : `readFile` sur la police + le client Supabase de
 *   `api.ts` supposent Node. Revalidation 24 h, alignée sur les pages.
 *
 * satori ne connaît que flexbox — pas de grid, pas de `display: block` implicite :
 * tout `<div>` à plusieurs enfants porte un `display: flex` explicite.
 */

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = 'image/png';

/** Palette — miroir littéral des tokens de globals.css (satori ne lit pas les var CSS). */
export const OG = {
  bg: '#ffffff',
  panel: '#f5f7fa',
  border: '#e6e9ee',
  teal: '#0d9488',
  cyan: '#34d1c4',
  or: '#b8943a',
  text: '#0c1d38',
  muted: '#5a6b82',
  positive: '#15803d',
  negative: '#dc2626',
} as const;

/**
 * Police de titrage embarquée EN FICHIER (src/assets/fonts), pas récupérée sur le
 * réseau à la génération : une image OG ne doit pas dépendre de la disponibilité de
 * Google Fonts au moment où un crawler social passe. IBM Plex Sans SemiBold est la
 * police de titrage de la charte ; SemiBold seul suffit — tout le texte des cartes
 * est du titrage ou du chiffre-vedette.
 *
 * satori ne lit ni woff2 ni EOT : le fichier est un TTF (OFL 1.1, voir OFL.txt).
 * `outputFileTracingIncludes` (next.config.ts) l'embarque dans le bundle serverless.
 */
export async function loadOgFont(): Promise<ArrayBuffer> {
  const file = path.join(process.cwd(), 'src/assets/fonts/IBMPlexSans-SemiBold.ttf');
  const buf = await readFile(file);
  return Uint8Array.from(buf).buffer;
}

/** Options `fonts` de ImageResponse — un seul poids, nommé comme la famille CSS. */
export async function ogFonts() {
  return [
    {
      name: 'IBM Plex Sans',
      data: await loadOgFont(),
      weight: 600 as const,
      style: 'normal' as const,
    },
  ];
}

/** Couleur d'une variation — gris si inconnue (jamais du vert par défaut). */
export function changeColor(value: number | null | undefined): string {
  if (value == null) return OG.muted;
  if (value > 0) return OG.positive;
  if (value < 0) return OG.negative;
  return OG.muted;
}

/**
 * Variation en pourcentage, format compact pour la miniature : 1 décimale, signe
 * toujours visible. `formatPct` (2 décimales) est trop bavard à cette taille.
 */
export function ogPct(value: number | null | undefined): string {
  if (value == null) return '—';
  const pct = value * 100;
  const sign = pct > 0 ? '+' : pct < 0 ? '−' : '';
  const abs = Math.abs(pct).toLocaleString('fr-FR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  return `${sign}${abs} %`;
}

/**
 * Cadre commun : bandeau de marque + horodatage en haut, pied de domaine en bas,
 * contenu du template au milieu.
 *
 * @param dataDate  date ISO de la donnée affichée (clôture). Rendue visible en haut
 *                  à droite sur les trois templates — exigence dure de la brique.
 */
export function OgShell({
  dataDate,
  children,
}: {
  dataDate: string | null;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: OG.bg,
        color: OG.text,
        fontFamily: 'IBM Plex Sans',
        padding: '44px 56px 36px 56px',
      }}
    >
      {/* Bandeau de marque — wordmark produit à gauche, date de la donnée à droite. */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingBottom: 18,
          borderBottom: `2px solid ${OG.border}`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center' }}>
          {/* Pastille teal : aplat plein, seul usage autorisé du cyan vif (charte). */}
          <div
            style={{
              display: 'flex',
              width: 18,
              height: 30,
              backgroundColor: OG.teal,
              borderRadius: 3,
              marginRight: 14,
            }}
          />
          <div style={{ display: 'flex', fontSize: 30, color: OG.text }}>
            {t.og.wordmark}
          </div>
        </div>
        {dataDate && (
          <div style={{ display: 'flex', fontSize: 21, color: OG.muted }}>
            {t.og.donneesDu} {formatDate(dataDate)}{t.og.clotureUs}
          </div>
        )}
      </div>

      {/* Contenu du template — occupe tout l'espace restant. */}
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, paddingTop: 22 }}>
        {children}
      </div>

      {/* Pied : domaine + éditeur. Petit mais présent — c'est la signature de marque. */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingTop: 14,
          borderTop: `1px solid ${OG.border}`,
          fontSize: 19,
          color: OG.muted,
        }}
      >
        <div style={{ display: 'flex' }}>{t.og.domaine}</div>
        <div style={{ display: 'flex' }}>{t.og.editeur}</div>
      </div>
    </div>
  );
}
