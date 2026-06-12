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
          <CartesianGrid strokeDasharray="3 3" stroke="#1e3a5f" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={formatShortDate}
            tick={{ fill: '#6b7280', fontSize: 11 }}
            axisLine={false} tickLine={false} minTickGap={40}
          />
          <YAxis
            tickFormatter={v => `${(v as number).toFixed(1)}`}
            tick={{ fill: '#6b7280', fontSize: 11 }}
            axisLine={false} tickLine={false} width={52}
            domain={['auto', 'auto']}
          />
          <Tooltip
            contentStyle={{ background: '#0f2044', border: '1px solid #1e3a5f', borderRadius: 6, fontSize: 12 }}
            labelStyle={{ color: '#e8eaf0', marginBottom: 4 }}
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
              return <span style={{ color: '#e8eaf0', fontSize: 12 }}>{lbl}</span>;
            }}
          />
          <Line type="monotone" dataKey="portfolio" stroke={portfolioColor} strokeWidth={2} dot={data.length < 30} activeDot={{ r: 4 }} />
          <Line type="monotone" dataKey="benchmark" stroke="#6b7280" strokeWidth={2} strokeDasharray="5 3" dot={false} activeDot={{ r: 4 }} connectNulls={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
