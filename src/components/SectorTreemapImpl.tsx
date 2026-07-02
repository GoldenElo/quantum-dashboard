'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { hierarchy, treemap, treemapSquarify } from 'd3-hierarchy';
import type { MarketCapRow } from '@/lib/api';
import { formatMarketCap, formatPct } from '@/lib/format';
import { t, TICKER_NOTES } from '@/i18n/t';

type View = 'pure_players' | 'secteur_complet';
type Horizon = 'jour' | 'semaine' | 'mois';

// Saturation de la couleur par horizon — l'amplitude des variations diffère selon la
// fenêtre. Ajustable. Au-delà de ce seuil (en valeur absolue), la tuile est à couleur pleine.
const SATURATION: Record<Horizon, number> = {
  jour: 0.06,     // ±6 %
  semaine: 0.15,  // ±15 %
  mois: 0.30,     // ±30 %
};

const CHANGE_KEY: Record<Horizon, keyof MarketCapRow> = {
  jour: 'change_1d',
  semaine: 'change_1w',
  mois: 'change_1m',
};

// Garde-fou vue « Tout le secteur » : Alphabet écrase la surface (propos assumé).
// On plancher l'aire de chaque tuile à cette fraction du total pour que les
// pure-players restent identifiables. Sans effet en vue pure-players.
const MIN_TILE_VALUE_FRACTION = 0.006;

// Charte CLAIRE — endpoints de l'échelle divergente + neutres.
const C_NEG = [220, 38, 38];    // #dc2626  --negative
const C_POS = [21, 128, 61];    // #15803d  --positive
const C_NEUTRAL = [238, 241, 245]; // #eef1f5 ≈ --bg-panel (stable)
const C_NULL = '#dde3ea';       // variation non calculable
const TEXT_DARK = '#0c1d38';    // --text (navy)
const TEXT_LIGHT = '#ffffff';

// Note HQ propre au Mur — volontairement hors du TICKER_NOTES partagé (ne pas
// altérer le tableau des capitalisations). Fusionnée en lecture seule ici.
const NOTES: Record<string, { marker: string; text: string }> = {
  ...TICKER_NOTES,
  HQ: t.mur.hqNote,
};

function mix(a: number[], b: number[], f: number): string {
  const r = Math.round(a[0] + (b[0] - a[0]) * f);
  const g = Math.round(a[1] + (b[1] - a[1]) * f);
  const bl = Math.round(a[2] + (b[2] - a[2]) * f);
  return `rgb(${r}, ${g}, ${bl})`;
}

function fillForChange(change: number | null, sat: number): string {
  if (change == null) return C_NULL;
  const c = Math.max(-1, Math.min(1, change / sat));
  if (c === 0) return `rgb(${C_NEUTRAL.join(', ')})`;
  return c < 0 ? mix(C_NEUTRAL, C_NEG, -c) : mix(C_NEUTRAL, C_POS, c);
}

// Luminance relative approx. → choisit un texte lisible (WCAG) sur le fond de tuile.
function textColorFor(change: number | null, sat: number): string {
  if (change == null) return TEXT_DARK;
  const c = Math.max(-1, Math.min(1, change / sat));
  const end = c < 0 ? C_NEG : C_POS;
  const f = Math.abs(c);
  const rgb = [
    C_NEUTRAL[0] + (end[0] - C_NEUTRAL[0]) * f,
    C_NEUTRAL[1] + (end[1] - C_NEUTRAL[1]) * f,
    C_NEUTRAL[2] + (end[2] - C_NEUTRAL[2]) * f,
  ];
  const lum = (0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]) / 255;
  return lum > 0.6 ? TEXT_DARK : TEXT_LIGHT;
}

function markersFor(row: MarketCapRow): string[] {
  const m: string[] = [];
  if (NOTES[row.ticker]) m.push(NOTES[row.ticker].marker);
  if (row.change_1w_extreme) m.push('⚑');
  return m;
}

type Leaf = {
  x0: number; y0: number; x1: number; y1: number;
  row: MarketCapRow;
  change: number | null;
};

export default function SectorTreemapImpl({ rows }: { rows: MarketCapRow[] }) {
  const [view, setView] = useState<View>('pure_players');
  const [horizon, setHorizon] = useState<Horizon>('jour');
  const [width, setWidth] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      setWidth(entries[0].contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const isNarrow = width > 0 && width < 560;
  // Mobile : conteneur plus haut → plus d'aire pour les petites tuiles.
  const height = width === 0
    ? 0
    : isNarrow
      ? Math.round(width * 1.1)
      : Math.round(Math.min(width * 0.52, 520));

  const viewRows = useMemo(
    () => (view === 'pure_players' ? rows.filter(r => r.category === 'pure_player') : rows),
    [rows, view],
  );

  const leaves = useMemo<Leaf[]>(() => {
    if (width === 0 || height === 0 || viewRows.length === 0) return [];

    const totalCap = viewRows.reduce((s, r) => s + r.market_cap_usd, 0);
    // Plancher d'aire uniquement en vue complète (garde-fou anti-écrasement).
    const floor = view === 'secteur_complet' ? totalCap * MIN_TILE_VALUE_FRACTION : 0;

    const data = viewRows.map(r => ({
      row: r,
      layoutValue: Math.max(r.market_cap_usd, floor),
    }));

    const root = hierarchy<{ children?: typeof data; row?: MarketCapRow; layoutValue?: number }>(
      { children: data },
    )
      .sum(d => d.layoutValue ?? 0)
      .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));

    treemap<{ row?: MarketCapRow; layoutValue?: number }>()
      .tile(treemapSquarify)
      .size([width, height])
      .paddingInner(2)
      .round(true)(root);

    const key = CHANGE_KEY[horizon];
    return (root.leaves() as unknown as Array<{ x0: number; y0: number; x1: number; y1: number; data: { row: MarketCapRow } }>)
      .map(l => {
        const row = l.data.row;
        const raw = row[key];
        return {
          x0: l.x0, y0: l.y0, x1: l.x1, y1: l.y1,
          row,
          change: typeof raw === 'number' ? raw : null,
        };
      });
  }, [viewRows, width, height, view, horizon]);

  const sat = SATURATION[horizon];

  // Repères présents dans la vue courante (légende dynamique).
  const presentMarkers = useMemo(() => {
    const seen = new Map<string, string>();
    for (const r of viewRows) {
      if (NOTES[r.ticker]) seen.set(NOTES[r.ticker].marker, `${r.ticker} — ${NOTES[r.ticker].text}`);
      if (r.change_1w_extreme) seen.set('⚑', t.mur.variationExceptionnelle);
    }
    return [...seen.entries()];
  }, [viewRows]);

  return (
    <div className="mur">
      {/* Contrôles */}
      <div className="mur-controls">
        <div className="mur-toggle" role="group" aria-label={t.mur.vueLabel}>
          {(['pure_players', 'secteur_complet'] as View[]).map(v => (
            <button
              key={v}
              type="button"
              className={`mur-toggle-btn ${view === v ? 'is-active' : ''}`}
              aria-pressed={view === v}
              aria-label={t.mur.vuesAria[v]}
              onClick={() => setView(v)}
            >
              {t.mur.vues[v]}
            </button>
          ))}
        </div>
        <div className="mur-toggle" role="group" aria-label={t.mur.horizonLabel}>
          {(['jour', 'semaine', 'mois'] as Horizon[]).map(h => (
            <button
              key={h}
              type="button"
              className={`mur-toggle-btn ${horizon === h ? 'is-active' : ''}`}
              aria-pressed={horizon === h}
              onClick={() => setHorizon(h)}
            >
              {t.mur.horizons[h]}
            </button>
          ))}
        </div>
      </div>

      {/* Treemap */}
      <div ref={containerRef} className="mur-canvas">
        {width > 0 && height > 0 && (
          <svg
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            role="img"
            aria-label={t.mur.aria.region}
          >
            {leaves.map(leaf => {
              const w = leaf.x1 - leaf.x0;
              const h = leaf.y1 - leaf.y0;
              const fill = fillForChange(leaf.change, sat);
              const color = textColorFor(leaf.change, sat);
              const marks = markersFor(leaf.row);
              const perfText = leaf.change == null ? t.mur.nonCalculable : formatPct(leaf.change);
              const titleText =
                `${leaf.row.ticker} · ${leaf.row.name} — ${formatMarketCap(leaf.row.market_cap_usd)} · ` +
                `${t.mur.horizons[horizon]} ${perfText}` +
                (marks.length ? ` (${marks.join(' ')})` : '');

              // Niveau de détail selon l'aire — jamais de tuile muette (title au minimum).
              const full = w >= 96 && h >= 66;
              const medium = !full && w >= 58 && h >= 38;
              const compact = !full && !medium && w >= 32 && h >= 18;

              return (
                <g key={leaf.row.ticker} transform={`translate(${leaf.x0}, ${leaf.y0})`}>
                  <title>{titleText}</title>
                  <rect width={w} height={h} rx={2} fill={fill} stroke="#ffffff" strokeWidth={1} />
                  {full && (
                    <>
                      <text x={8} y={19} className="mur-tile-ticker" fill={color}>
                        {leaf.row.ticker}
                        {marks.length > 0 && (
                          <tspan className="mur-tile-mark" dx={4}>{marks.join(' ')}</tspan>
                        )}
                      </text>
                      <text x={8} y={37} className="mur-tile-perf" fill={color}>{perfText}</text>
                      <text x={8} y={53} className="mur-tile-cap" fill={color} opacity={0.85}>
                        {formatMarketCap(leaf.row.market_cap_usd)}
                      </text>
                    </>
                  )}
                  {medium && (
                    <>
                      <text x={6} y={16} className="mur-tile-ticker sm" fill={color}>
                        {leaf.row.ticker}
                        {marks.length > 0 && (
                          <tspan className="mur-tile-mark" dx={3}>{marks.join(' ')}</tspan>
                        )}
                      </text>
                      <text x={6} y={31} className="mur-tile-perf sm" fill={color}>{perfText}</text>
                    </>
                  )}
                  {compact && (
                    <text x={4} y={14} className="mur-tile-ticker xs" fill={color}>
                      {leaf.row.ticker}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        )}
      </div>

      {/* Légende couleur */}
      <div className="mur-legend">
        <div className="mur-legend-scale">
          <span className="mur-legend-label">{t.mur.legende.baisse}</span>
          <span className="mur-legend-bar" aria-hidden="true" />
          <span className="mur-legend-label">{t.mur.legende.hausse}</span>
        </div>
        <div className="mur-legend-null">
          <span className="mur-legend-swatch" aria-hidden="true" />
          {t.mur.legende.nonCalculableItem}
        </div>
      </div>

      {/* Repères présents */}
      {presentMarkers.length > 0 && (
        <div className="mur-markers">
          <span className="mur-markers-title">{t.mur.marqueursTitre} :</span>
          {presentMarkers.map(([marker, text]) => (
            <span key={marker} className="mur-marker-item">
              <span className="mur-marker-sym">{marker}</span> {text}
            </span>
          ))}
        </div>
      )}

      {/* Garde-fou taille minimale — expliqué uniquement en vue complète */}
      {view === 'secteur_complet' && <p className="mur-floor-note">{t.mur.floorNote}</p>}
    </div>
  );
}
