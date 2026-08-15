'use client';

import dynamic from 'next/dynamic';
import type { SeriesKey } from '@/lib/theme';

type DataPoint = { date: string; portfolio: number; benchmark: number | null };
// `portfolioKey` et non `portfolioColor` : la couleur dépend du thème, elle est
// résolue côté client (D3 — mode sombre).
type Props = {
  data: DataPoint[];
  portfolioLabel: string;
  portfolioKey: SeriesKey;
  benchmarkLabel?: string;
};

const Impl = dynamic(
  () => import('./DetailChartImpl'),
  { ssr: false, loading: () => <div className="chart-placeholder" /> }
);

export default function DetailChart(props: Props) {
  return <Impl {...props} />;
}
