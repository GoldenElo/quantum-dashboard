'use client';

import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { CHART_CHROME, PIE_COLORS, PIE_FALLBACK } from '@/lib/theme';
import { useThemeMode } from '@/lib/useThemeMode';

type Slice = { ticker: string; name: string; weight: number };
const pctLabel = (v: number) => `${(v * 100).toFixed(1)} %`;

function SinglePie({ data, title }: { data: Slice[]; title: string }) {
  const mode = useThemeMode();
  const chrome = CHART_CHROME[mode];
  const tickerColors = PIE_COLORS[mode];

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
                <Cell key={e.ticker} fill={tickerColors[e.ticker] ?? PIE_FALLBACK[mode]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{ background: chrome.tooltipBg, border: `1px solid ${chrome.tooltipBorder}`, borderRadius: 6, fontSize: 12 }}
              labelStyle={{ color: chrome.tooltipLabel }}
              itemStyle={{ color: chrome.tooltipLabel }}
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
                return <span style={{ color: chrome.legend, fontSize: 11 }}>{s?.name ?? value}</span>;
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
