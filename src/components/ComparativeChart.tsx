'use client';

import dynamic from 'next/dynamic';
import type { ChartPoint } from '@/lib/api';

export type SeriesConfig = {
  key: string;
  label: string;
  color: string;
  dashed?: boolean;
};

// dynamic(ssr:false) is valid here because this IS a 'use client' module
const Impl = dynamic(
  () => import('./ComparativeChartImpl'),
  { ssr: false, loading: () => <div className="chart-placeholder" /> }
);

export default function ComparativeChart(props: { data: ChartPoint[]; series: SeriesConfig[] }) {
  return <Impl {...props} />;
}
