'use client';

import dynamic from 'next/dynamic';
import type { IndexPoint } from '@/lib/api';

// dynamic(ssr:false) est valide ici parce que CE module est 'use client'
// (même pattern que ComparativeChart / CompanyCapChart / DetailChart).
const Impl = dynamic(() => import('./IndexChartImpl'), {
  ssr: false,
  loading: () => <div className="chart-placeholder" />,
});

export default function IndexChart(props: { data: IndexPoint[] }) {
  return <Impl {...props} />;
}
