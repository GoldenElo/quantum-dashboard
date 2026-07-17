'use client';

import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { formatShortDate, formatMarketCap } from '@/lib/format';
import { t } from '@/i18n/t';
import type { CapPoint } from './CompanyCapChart';

// Courbe de capitalisation d'une société — une seule série (pas de base 100,
// valeurs absolues en $), charte claire, accent teal foncé.
const CAP_COLOR = '#0d9488'; // --accent-blue

export default function CompanyCapChartImpl({ data }: { data: CapPoint[] }) {
  if (data.length < 2) {
    return <p className="empty-state">{t.societe.capChart.insuffisant}</p>;
  }

  return (
    <div style={{ width: '100%', height: 280 }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="capFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={CAP_COLOR} stopOpacity={0.18} />
              <stop offset="100%" stopColor={CAP_COLOR} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e6e9ee" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={formatShortDate}
            tick={{ fill: '#5a6b82', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}
            axisLine={false} tickLine={false} minTickGap={40}
          />
          <YAxis
            tickFormatter={v => formatMarketCap(v as number)}
            tick={{ fill: '#5a6b82', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}
            axisLine={false} tickLine={false} width={64}
            domain={['auto', 'auto']}
          />
          <Tooltip
            contentStyle={{ background: '#ffffff', border: '1px solid #e6e9ee', borderRadius: 6, fontSize: 12 }}
            labelStyle={{ color: '#0c1d38', marginBottom: 4, fontFamily: 'JetBrains Mono, monospace' }}
            labelFormatter={(label) => formatShortDate(String(label))}
            formatter={(value) => [formatMarketCap(typeof value === 'number' ? value : 0), t.societe.capChart.serieLabel]}
          />
          <Area
            type="monotone" dataKey="market_cap"
            stroke={CAP_COLOR} strokeWidth={2}
            fill="url(#capFill)"
            dot={data.length < 30} activeDot={{ r: 4 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
