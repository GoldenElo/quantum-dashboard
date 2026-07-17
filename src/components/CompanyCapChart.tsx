'use client';

import dynamic from 'next/dynamic';

export type CapPoint = { date: string; market_cap: number };

// dynamic(ssr:false) — même pattern que DetailChart/SectorTreemap : le graphe
// Recharts mesure sa largeur côté client, on évite tout mismatch d'hydratation.
const Impl = dynamic(
  () => import('./CompanyCapChartImpl'),
  { ssr: false, loading: () => <div className="chart-placeholder" /> }
);

export default function CompanyCapChart({ data }: { data: CapPoint[] }) {
  return <Impl data={data} />;
}
