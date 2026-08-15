'use client';

import dynamic from 'next/dynamic';
import type { ChartPoint } from '@/lib/api';
import type { SeriesKey } from '@/lib/theme';

// La série porte sa CLÉ, pas sa couleur : la couleur dépend du thème et ne peut
// donc pas être figée par un composant serveur (D3 — mode sombre).
export type SeriesConfig = {
  key: SeriesKey;
  label: string;
  dashed?: boolean;
  strokeWidth?: number;
};

// dynamic(ssr:false) is valid here because this IS a 'use client' module
const Impl = dynamic(
  () => import('./ComparativeChartImpl'),
  { ssr: false, loading: () => <div className="chart-placeholder" /> }
);

export default function ComparativeChart(props: { data: ChartPoint[]; series: SeriesConfig[] }) {
  return <Impl {...props} />;
}
