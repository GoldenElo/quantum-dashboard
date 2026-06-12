'use client';

import dynamic from 'next/dynamic';

type Slice = { ticker: string; name: string; weight: number };
type Props = { current: Slice[]; inception: Slice[] };

const Impl = dynamic(
  () => import('./AllocationPieImpl'),
  { ssr: false, loading: () => <div className="chart-placeholder" style={{ height: 260 }} /> }
);

export default function AllocationPie(props: Props) {
  return <Impl {...props} />;
}
