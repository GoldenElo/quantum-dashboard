import { ImageResponse } from 'next/og';
import { fetchMarketCapsData } from '@/lib/api';
import { formatMarketCap } from '@/lib/format';
import { t } from '@/i18n/t';
import {
  OG,
  OG_CONTENT_TYPE,
  OG_SIZE,
  OgShell,
  changeColor,
  ogFonts,
  ogPct,
} from '@/lib/og';

/**
 * Image OG de l'accueil — LE MUR (C4).
 *
 * Barres horizontales proportionnelles à la capitalisation, colorées par la
 * variation du jour. Choix assumé face à une treemap fidèle : en miniature, une
 * treemap devient une mosaïque de rectangles illisibles, alors qu'une pile de
 * barres alignées lit l'effet « mur rouge/vert » d'un coup d'œil et garde les
 * tickers déchiffrables. L'effet mur prime sur la fidélité de la treemap ;
 * /mur reste la vue exacte.
 *
 * Runtime Node (Supabase + lecture de la police), revalidation 24 h comme les pages.
 */
export const runtime = 'nodejs';
export const revalidate = 86400;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = t.og.accueil.alt;

/**
 * Nombre de barres affichées. Budget vertical : 630 − cadre − bloc titre ≈ 300 px.
 * À 8 barres, chaque ligne fait 34 px — le plancher pour que le ticker reste
 * lisible une fois la carte réduite à 300 px de large. En ajouter une les rend
 * toutes illisibles : le reste du panel est annoncé en une ligne sous le mur.
 */
const MAX_BARS = 8;

export default async function Image() {
  const data = await fetchMarketCapsData().catch(() => null);

  // Une barre est proportionnelle à une capitalisation : sans capitalisation, pas
  // de barre possible. Ces sociétés sont exclues du mur ET comptées dans le
  // « + N autres pure-players », de sorte que la troncature reste annoncée.
  const pureplayers = (data?.rows ?? [])
    .filter(row => row.category === 'pure_player' && row.market_cap_usd != null)
    .sort((a, b) => (b.market_cap_usd ?? 0) - (a.market_cap_usd ?? 0));
  const unsized = (data?.rows ?? [])
    .filter(row => row.category === 'pure_player' && row.market_cap_usd == null).length;

  const shown = pureplayers.slice(0, MAX_BARS);
  const hidden = pureplayers.length - shown.length + unsized;
  // Échelle des barres : la plus grosse capitalisation occupe toute la largeur.
  const maxCap = shown[0]?.market_cap_usd ?? 0;
  // Date de la donnée = clôture la plus récente parmi les lignes (dates ISO → tri lexical).
  const dataDate = shown.map(r => r.price_date).sort().at(-1) ?? null;

  return new ImageResponse(
    (
      <OgShell dataDate={dataDate}>
        {/* ── Bloc de tête : titre + total pure-players (unique chiffre en or) ── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            marginBottom: 14,
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', fontSize: 44, color: OG.text }}>
              {t.og.accueil.titre}
            </div>
            <div style={{ display: 'flex', fontSize: 20, color: OG.muted, marginTop: 6 }}>
              {t.og.accueil.barresLegende}
            </div>
          </div>
          {data && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
              <div style={{ display: 'flex', fontSize: 19, color: OG.muted }}>
                {t.og.accueil.totalLabel}
              </div>
              {/* Chiffre-vedette en or — une seule occurrence par vue (charte). */}
              <div style={{ display: 'flex', fontSize: 52, color: OG.or, marginTop: 2 }}>
                {formatMarketCap(data.pure_player_total_usd)}
              </div>
            </div>
          )}
        </div>

        {/* ── Le mur : une barre par pure-player ── */}
        {shown.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
            {shown.map(row => {
              const width = maxCap > 0 ? ((row.market_cap_usd ?? 0) / maxCap) * 100 : 0;
              const color = changeColor(row.change_1d);
              return (
                <div
                  key={row.ticker}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    height: 32,
                    marginBottom: 4,
                  }}
                >
                  {/* Ticker — largeur fixe pour que toutes les barres démarrent alignées. */}
                  <div
                    style={{
                      display: 'flex',
                      width: 92,
                      fontSize: 24,
                      color: OG.text,
                    }}
                  >
                    {row.ticker}
                  </div>
                  {/* Piste + remplissage proportionnel. */}
                  <div
                    style={{
                      display: 'flex',
                      flex: 1,
                      height: 26,
                      backgroundColor: OG.panel,
                      borderRadius: 4,
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        width: `${width}%`,
                        height: '100%',
                        backgroundColor: color,
                        borderRadius: 4,
                      }}
                    />
                  </div>
                  {/* Capitalisation puis variation — les deux chiffres de la ligne. */}
                  <div
                    style={{
                      display: 'flex',
                      width: 132,
                      justifyContent: 'flex-end',
                      fontSize: 23,
                      color: OG.text,
                    }}
                  >
                    {formatMarketCap(row.market_cap_usd ?? 0)}
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      width: 108,
                      justifyContent: 'flex-end',
                      fontSize: 23,
                      color,
                    }}
                  >
                    {ogPct(row.change_1d)}
                  </div>
                </div>
              );
            })}
            {/* Troncature ANNONCÉE : une carte qui montre 8 lignes sur 11 sans le dire
                laisserait croire que le panel en compte 8. */}
            {hidden > 0 && (
              <div style={{ display: 'flex', fontSize: 19, color: OG.muted, marginTop: 6 }}>
                {t.og.accueil.reste(hidden)}
              </div>
            )}
          </div>
        ) : (
          // Base injoignable : carte de marque valide plutôt qu'un aperçu cassé.
          <div style={{ display: 'flex', flex: 1, alignItems: 'center', fontSize: 30, color: OG.muted }}>
            {t.og.fallback.indisponible}
          </div>
        )}
      </OgShell>
    ),
    { ...OG_SIZE, fonts: await ogFonts() },
  );
}
