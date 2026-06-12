'use client';

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { formatShortDate } from '@/lib/format';

type DataPoint = { date: string; portfolio: number; benchmark: number | null };
type Props = { data: DataPoint[]; portfolioLabel: string; portfolioColor: string; benchmarkLabel?: string };

export default function DetailChartImpl({
  data, portfolioLabel, portfolioColor, benchmarkLabel = 'VanEck UCITS',
}: Props) {
  if (data.length === 0) return <p className="empty-state">Données insuffisantes.</p>;

  return (
    <div style={{ width: '100%', height: 300 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1E2B4D" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={formatShortDate}
            tick={{ fill: '#A9B8D4', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}
            axisLine={false} tickLine={false} minTickGap={40}
          />
          <YAxis
            tickFormatter={v => `${(v as number).toFixed(1)}`}
            tick={{ fill: '#A9B8D4', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}
            axisLine={false} tickLine={false} width={52}
            domain={['auto', 'auto']}
          />
          <Tooltip
            contentStyle={{ background: '#0D1530', border: '1px solid #1E2B4D', borderRadius: 6, fontSize: 12 }}
            labelStyle={{ color: '#FFFFFF', marginBottom: 4, fontFamily: 'JetBrains Mono, monospace' }}
            labelFormatter={(label) => formatShortDate(String(label))}
            formatter={(value, name) => {
              const v = typeof value === 'number' ? value : 0;
              const lbl = String(name) === 'portfolio' ? portfolioLabel : benchmarkLabel;
              return [`${v.toFixed(2)}`, lbl];
            }}
          />
          <Legend
            formatter={(value: string) => {
              const lbl = value === 'portfolio' ? portfolioLabel : benchmarkLabel;
              return <span style={{ color: '#A9B8D4', fontSize: 12 }}>{lbl}</span>;
            }}
          />
          <Line type="monotone" dataKey="portfolio" stroke={portfolioColor} strokeWidth={2} dot={data.length < 30} activeDot={{ r: 4 }} />
          <Line type="monotone" dataKey="benchmark" stroke="#94A3B8" strokeWidth={1.5} strokeDasharray="5 3" dot={false} activeDot={{ r: 4 }} connectNulls={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
