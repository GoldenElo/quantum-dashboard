'use client';

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { formatShortDate } from '@/lib/format';
import type { IndexPoint } from '@/lib/api';
import { t } from '@/i18n/t';
import { CHART_CHROME, SERIES_COLORS, type SeriesKey } from '@/lib/theme';
import { useThemeMode } from '@/lib/useThemeMode';

type Props = { data: IndexPoint[] };

// L'indice en teal plein et épais (série principale), les deux références en
// tirets gris — mêmes clés de série que le graphique comparatif de l'accueil
// pour que le lecteur retrouve ses repères d'une page à l'autre, dans les deux modes.
const SERIES: ReadonlyArray<{ key: SeriesKey; label: string; width: number; dashed: boolean }> = [
  { key: 'indice',    label: t.indice.chart.series.indice,    width: 2.5, dashed: false },
  { key: 'benchmark', label: t.indice.chart.series.benchmark, width: 1.5, dashed: true  },
  { key: 'nasdaq100', label: t.indice.chart.series.nasdaq100, width: 1.5, dashed: true  },
];

export default function IndexChartImpl({ data }: Props) {
  const mode = useThemeMode();
  const chrome = CHART_CHROME[mode];
  const colors = SERIES_COLORS[mode];

  if (data.length < 2) return <p className="empty-state">{t.indice.chart.insuffisant}</p>;

  return (
    <div style={{ width: '100%', height: 340 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={chrome.grid} vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={formatShortDate}
            tick={{ fill: chrome.axis, fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}
            axisLine={false} tickLine={false} minTickGap={40}
          />
          <YAxis
            tickFormatter={v => `${(v as number).toFixed(0)}`}
            tick={{ fill: chrome.axis, fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}
            axisLine={false} tickLine={false} width={52}
            domain={['auto', 'auto']}
          />
          {/* Repère de la base 100 — rend la lecture immédiate (au-dessus / en dessous) */}
          <ReferenceLine y={100} stroke={chrome.grid} strokeWidth={1} />
          <Tooltip
            contentStyle={{ background: chrome.tooltipBg, border: `1px solid ${chrome.tooltipBorder}`, borderRadius: 6, fontSize: 12 }}
            labelStyle={{ color: chrome.tooltipLabel, marginBottom: 4, fontFamily: 'JetBrains Mono, monospace' }}
            itemStyle={{ color: chrome.tooltipLabel }}
            labelFormatter={(label) => formatShortDate(String(label))}
            formatter={(value, name) => {
              const v = typeof value === 'number' ? value : 0;
              const s = SERIES.find(s => s.key === String(name));
              return [`${v.toFixed(2)}`, s?.label ?? String(name)];
            }}
          />
          <Legend
            formatter={(value: string) => {
              const s = SERIES.find(s => s.key === value);
              return <span style={{ color: chrome.legend, fontSize: 12 }}>{s?.label ?? value}</span>;
            }}
          />
          {SERIES.map(s => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              stroke={colors[s.key]}
              strokeWidth={s.width}
              strokeDasharray={s.dashed ? '5 3' : undefined}
              dot={false}
              activeDot={{ r: 4 }}
              // Les références sont des repères de contexte, pas des mesures : le
              // calendrier LSE de QNTM.L diffère du calendrier US, et un trou dans
              // un trait de contexte ajoute du bruit, pas de l'information.
              // L'indice, lui, ne raccorde jamais (connectNulls={false}).
              connectNulls={s.dashed}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
