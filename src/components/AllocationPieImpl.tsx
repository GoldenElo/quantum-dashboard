'use client';

import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const TICKER_COLORS: Record<string, string> = {
  GOOGL: '#4f9eff', IBM: '#818cf8', NVDA: '#34d399',
  IONQ: '#c9a84c', QBTS: '#f472b6', LAES: '#fb923c', INFQ: '#a78bfa',
};

type Slice = { ticker: string; name: string; weight: number };
const pctLabel = (v: number) => `${(v * 100).toFixed(1)} %`;

function SinglePie({ data, title }: { data: Slice[]; title: string }) {
  return (
    <div className="pie-wrap">
      <p className="pie-title">{title}</p>
      <div style={{ width: '100%', height: 260 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart margin={{ top: 20, right: 20, bottom: 0, left: 20 }}>
            <Pie
              data={data} dataKey="weight" nameKey="ticker"
              cx="50%" cy="52%" outerRadius={72}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              label={(p: any) => {
                const w = p.weight as number | undefined;
                return w != null && w >= 0.08 ? `${p.ticker} ${pctLabel(w)}` : '';
              }}
              labelLine={false}
            >
              {data.map(e => (
                <Cell key={e.ticker} fill={TICKER_COLORS[e.ticker] ?? '#6b7280'} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{ background: '#0D1530', border: '1px solid #1E2B4D', borderRadius: 6, fontSize: 12 }}
              labelStyle={{ color: '#FFFFFF' }}
              formatter={(value, name) => {
                const v = typeof value === 'number' ? value : 0;
                const slice = data.find(d => d.ticker === String(name));
                return [pctLabel(v), slice?.name ?? String(name)];
              }}
            />
            <Legend
              wrapperStyle={{ paddingTop: '12px' }}
              formatter={(value: string) => {
                const s = data.find(d => d.ticker === value);
                return <span style={{ color: '#A9B8D4', fontSize: 11 }}>{s?.name ?? value}</span>;
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

type Props = { current: Slice[]; inception: Slice[]; inceptionDateLabel: string };

export default function AllocationPieImpl({ current, inception, inceptionDateLabel }: Props) {
  return (
    <div className="pies-container">
      <SinglePie data={inception} title={`Poids au ${inceptionDateLabel}`} />
      <SinglePie data={current}   title="Poids actuels" />
    </div>
  );
}
