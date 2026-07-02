'use client';

import dynamic from 'next/dynamic';
import type { MarketCapRow } from '@/lib/api';

// dynamic(ssr:false) valide ici car ce module est 'use client' — la treemap mesure
// sa largeur via ResizeObserver, on évite tout mismatch d'hydratation (cf. ComparativeChart).
const Impl = dynamic(
  () => import('./SectorTreemapImpl'),
  { ssr: false, loading: () => <div className="chart-placeholder mur-placeholder" /> }
);

export default function SectorTreemap({ rows }: { rows: MarketCapRow[] }) {
  return <Impl rows={rows} />;
}
