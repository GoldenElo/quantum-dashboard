'use client';

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { formatShortDate } from '@/lib/format';
import type { ChartPoint } from '@/lib/api';
import { CHART_CHROME, SERIES_COLORS } from '@/lib/theme';
import { useThemeMode } from '@/lib/useThemeMode';
import type { SeriesConfig } from './ComparativeChart';

type Props = { data: ChartPoint[]; series: SeriesConfig[] };

export default function ComparativeChartImpl({ data, series }: Props) {
  // Recharts reçoit ses couleurs en props JS : elles suivent le thème ici,
  // depuis la même source que le CSS (src/lib/theme.ts).
  const mode = useThemeMode();
  const chrome = CHART_CHROME[mode];
  const colors = SERIES_COLORS[mode];

  if (data.length === 0) return <p className="empty-state">Données insuffisantes.</p>;

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
            tickFormatter={v => `${(v as number).toFixed(1)}`}
            tick={{ fill: chrome.axis, fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}
            axisLine={false} tickLine={false} width={52}
            domain={['auto', 'auto']}
          />
          <Tooltip
            contentStyle={{ background: chrome.tooltipBg, border: `1px solid ${chrome.tooltipBorder}`, borderRadius: 6, fontSize: 12 }}
            labelStyle={{ color: chrome.tooltipLabel, marginBottom: 4, fontFamily: 'JetBrains Mono, monospace' }}
            itemStyle={{ color: chrome.tooltipLabel }}
            labelFormatter={(label) => formatShortDate(String(label))}
            formatter={(value, name) => {
              const v = typeof value === 'number' ? value : 0;
              const s = series.find(s => s.key === String(name));
              return [`${v.toFixed(2)}`, s?.label ?? String(name)];
            }}
          />
          <Legend
            formatter={(value: string) => {
              const s = series.find(s => s.key === value);
              return <span style={{ color: chrome.legend, fontSize: 12 }}>{s?.label ?? value}</span>;
            }}
          />
          {series.map(s => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              stroke={colors[s.key]}
              strokeWidth={s.strokeWidth ?? 2}
              strokeDasharray={s.dashed ? '5 3' : undefined}
              dot={data.length < 30}
              activeDot={{ r: 4 }}
              connectNulls={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
