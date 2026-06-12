'use client';

import dynamic from 'next/dynamic';

type DataPoint = { date: string; portfolio: number; benchmark: number | null };
type Props = { data: DataPoint[]; portfolioLabel: string; portfolioColor: string; benchmarkLabel?: string };

const Impl = dynamic(
  () => import('./DetailChartImpl'),
  { ssr: false, loading: () => <div className="chart-placeholder" /> }
);

export default function DetailChart(props: Props) {
  return <Impl {...props} />;
}
