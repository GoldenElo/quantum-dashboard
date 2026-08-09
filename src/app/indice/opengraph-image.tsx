import { ImageResponse } from 'next/og';
import { fetchIndexData } from '@/lib/api';
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
 * Image OG de l'Indice TQW (C4) — la carte de l'IP propriétaire.
 *
 * La valeur et la performance depuis l'inception sont LUES dans `index_daily`
 * (via fetchIndexData) : rien n'est recalculé ici, conformément à la règle dure
 * « calcul dans l'ingestion, jamais dans le front ». La sparkline ne fait que
 * tracer la série publiée.
 */
export const runtime = 'nodejs';
export const revalidate = 86400;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = t.og.indice.alt;

const SPARK_WIDTH = 1088;
const SPARK_HEIGHT = 128;
const INDEX_BASE = 100;

/**
 * Sparkline de la série publiée. Rendue en SVG inline (satori sait tracer un
 * `path`), pas en Recharts : aucun composant client n'est disponible ici.
 */
function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null;

  // L'échelle inclut la base 100 pour que le repère reste dans le cadre : sans
  // cela, un indice durablement sous sa base afficherait une courbe flottante
  // sans point de comparaison visible.
  const lo = Math.min(...values, INDEX_BASE);
  const hi = Math.max(...values, INDEX_BASE);
  const span = hi - lo || 1;

  const x = (i: number) => (i / (values.length - 1)) * SPARK_WIDTH;
  const y = (v: number) => SPARK_HEIGHT - ((v - lo) / span) * SPARK_HEIGHT;

  const line = values.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  // Aire sous la courbe — donne du corps au tracé en miniature.
  const area = `${line} L${SPARK_WIDTH},${SPARK_HEIGHT} L0,${SPARK_HEIGHT} Z`;
  const baseY = y(INDEX_BASE).toFixed(1);

  return (
    <svg width={SPARK_WIDTH} height={SPARK_HEIGHT} viewBox={`0 0 ${SPARK_WIDTH} ${SPARK_HEIGHT}`}>
      <path d={area} fill={OG.panel} />
      {/* Repère de base 100 — en tirets, gris : un repère, pas une série. */}
      <line
        x1="0"
        y1={baseY}
        x2={SPARK_WIDTH}
        y2={baseY}
        stroke={OG.muted}
        strokeWidth="1.5"
        strokeDasharray="6 5"
      />
      <path d={line} fill="none" stroke={OG.teal} strokeWidth="4" />
    </svg>
  );
}

export default async function Image() {
  const index = await fetchIndexData().catch(() => null);

  if (!index) {
    // Migration 010 non appliquée ou base injoignable — dégradation gracieuse,
    // même contrat que la page /indice.
    return new ImageResponse(
      (
        <OgShell dataDate={null}>
          <div style={{ display: 'flex', flex: 1, flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ display: 'flex', fontSize: 62, color: OG.text }}>{t.og.indice.nom}</div>
            <div style={{ display: 'flex', fontSize: 26, color: OG.muted, marginTop: 12 }}>
              {t.og.fallback.indisponible}
            </div>
          </div>
        </OgShell>
      ),
      { ...OG_SIZE, fonts: await ogFonts() },
    );
  }

  const values = index.series
    .map(p => p.indice)
    .filter((v): v is number => v != null);

  const perf = index.change_since_inception;

  return new ImageResponse(
    (
      <OgShell dataDate={index.latest_date}>
        {/* ── Tête : nom de l'indice + accroche ── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', fontSize: 52, color: OG.text }}>
              {t.og.indice.nom}
            </div>
            <div style={{ display: 'flex', fontSize: 21, color: OG.muted, marginTop: 4 }}>
              {t.og.indice.accroche}
            </div>
          </div>
          {/* Constituants — chiffre de contexte, discret. */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            <div style={{ display: 'flex', fontSize: 19, color: OG.muted }}>
              {t.og.indice.constituants}
            </div>
            <div style={{ display: 'flex', fontSize: 40, color: OG.text, marginTop: 2 }}>
              {index.constituents.length}
            </div>
          </div>
        </div>

        {/* ── Les deux chiffres qui portent la carte ── */}
        <div style={{ display: 'flex', alignItems: 'flex-end', marginTop: 22 }}>
          <div style={{ display: 'flex', flexDirection: 'column', marginRight: 72 }}>
            <div style={{ display: 'flex', fontSize: 20, color: OG.muted }}>
              {t.og.indice.valeurLabel}
            </div>
            {/* Valeur de l'indice — chiffre-vedette, seul en or. */}
            <div style={{ display: 'flex', fontSize: 80, color: OG.or, marginTop: 2 }}>
              {index.value.toLocaleString('fr-FR', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', fontSize: 20, color: OG.muted }}>
              {t.og.indice.depuisInception}
            </div>
            <div style={{ display: 'flex', fontSize: 80, color: changeColor(perf), marginTop: 2 }}>
              {ogPct(perf)}
            </div>
          </div>
        </div>

        {/* ── Sparkline de la série publiée ── */}
        <div style={{ display: 'flex', flex: 1, alignItems: 'flex-end', marginTop: 16 }}>
          <Sparkline values={values} />
        </div>

        <div style={{ display: 'flex', fontSize: 18, color: OG.muted, marginTop: 10 }}>
          {t.og.indice.base}
        </div>
      </OgShell>
    ),
    { ...OG_SIZE, fonts: await ogFonts() },
  );
}
