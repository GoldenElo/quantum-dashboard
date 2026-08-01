'use client';

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { formatShortDate } from '@/lib/format';
import type { IndexPoint } from '@/lib/api';
import { t } from '@/i18n/t';

type Props = { data: IndexPoint[] };

// L'indice en teal plein et épais (série principale), les deux références en
// tirets gris — charte claire, mêmes couleurs que le graphique comparatif de
// l'accueil pour que le lecteur retrouve ses repères d'une page à l'autre.
const SERIES = [
  { key: 'indice',    label: t.indice.chart.series.indice,    color: '#0d9488', width: 2.5, dashed: false },
  { key: 'benchmark', label: t.indice.chart.series.benchmark, color: '#5a6b82', width: 1.5, dashed: true  },
  { key: 'nasdaq100', label: t.indice.chart.series.nasdaq100, color: '#8099B3', width: 1.5, dashed: true  },
] as const;

export default function IndexChartImpl({ data }: Props) {
  if (data.length < 2) return <p className="empty-state">{t.indice.chart.insuffisant}</p>;

  return (
    <div style={{ width: '100%', height: 340 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e6e9ee" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={formatShortDate}
            tick={{ fill: '#5a6b82', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}
            axisLine={false} tickLine={false} minTickGap={40}
          />
          <YAxis
            tickFormatter={v => `${(v as number).toFixed(0)}`}
            tick={{ fill: '#5a6b82', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}
            axisLine={false} tickLine={false} width={52}
            domain={['auto', 'auto']}
          />
          {/* Repère de la base 100 — rend la lecture immédiate (au-dessus / en dessous) */}
          <ReferenceLine y={100} stroke="#e6e9ee" strokeWidth={1} />
          <Tooltip
            contentStyle={{ background: '#ffffff', border: '1px solid #e6e9ee', borderRadius: 6, fontSize: 12 }}
            labelStyle={{ color: '#0c1d38', marginBottom: 4, fontFamily: 'JetBrains Mono, monospace' }}
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
              return <span style={{ color: '#5a6b82', fontSize: 12 }}>{s?.label ?? value}</span>;
            }}
          />
          {SERIES.map(s => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              stroke={s.color}
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
