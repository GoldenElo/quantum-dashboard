import { fetchHomepageData } from '@/lib/api';
import { formatDate } from '@/lib/format';
import PortfolioCard from '@/components/PortfolioCard';
import ComparativeChart from '@/components/ComparativeChart';
import type { SeriesConfig } from '@/components/ComparativeChart';

export const revalidate = 86400;

const COMPARATIVE_SERIES: SeriesConfig[] = [
  { key: 'defensif',  label: 'Défensif',        color: '#2563EB' },
  { key: 'dynamique', label: 'Dynamique',        color: '#0d9488' },
  { key: 'agressif',  label: 'Agressif',         color: '#7C3AED' },
  { key: 'personnel', label: 'Mon portefeuille', color: '#c2410c' },
  { key: 'benchmark', label: 'VanEck UCITS',     color: '#5a6b82', dashed: true },
  { key: 'nasdaq100', label: 'Nasdaq-100',       color: '#8099B3', dashed: true, strokeWidth: 1.5 },
];

export default async function HomePage() {
  const { summaries, chartData } = await fetchHomepageData();
  const inceptionDate = summaries[0]?.inception_date ?? '';

  return (
    <main className="page">
      <header className="home-header">
        <h1 className="home-title">Dashboard Quantique</h1>
        <p className="home-subtitle">
          Suivi de 3 portefeuilles fictifs à but pédagogique — données de clôture à J&#8209;1
        </p>
      </header>

      <section aria-label="Portefeuilles">
        <div className="cards-grid">
          {summaries.map(s => (
            <PortfolioCard key={s.id} summary={s} />
          ))}
        </div>
      </section>

      <section className="section" aria-label="Performance comparative">
        <h2 className="section-title">Performance comparative — base 100</h2>
        <div className="chart-container">
          <ComparativeChart data={chartData} series={COMPARATIVE_SERIES} />
        </div>
        <p className="chart-note">
          Base 100 depuis le {formatDate(inceptionDate)} · Benchmarks en tirets : VanEck Quantum Computing UCITS ETF (QNTM.L) · Nasdaq-100 (QQQ)
        </p>
      </section>
    </main>
  );
}
