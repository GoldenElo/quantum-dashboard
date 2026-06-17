import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { fetchPortfolioDetail } from '@/lib/api';
import { formatUSD, formatPct, formatDate } from '@/lib/format';
import Disclaimer from '@/components/Disclaimer';
import HoldingsTable from '@/components/HoldingsTable';
import DetailChart from '@/components/DetailChart';
import AllocationPie from '@/components/AllocationPie';

export const revalidate = 86400;

const PORTFOLIO_COLORS: Record<string, string> = {
  defensif:  '#2563EB',
  dynamique: '#0d9488',
  agressif:  '#7C3AED',
};

const PORTFOLIO_LABELS: Record<string, string> = {
  defensif:  'Défensif',
  dynamique: 'Dynamique',
  agressif:  'Agressif',
};

export function generateStaticParams() {
  return [
    { id: 'defensif' },
    { id: 'dynamique' },
    { id: 'agressif' },
  ];
}

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const label = PORTFOLIO_LABELS[id] ?? id;
  return {
    title: `Portefeuille ${label} — L'Investisseuse Quantique`,
  };
}

export default async function PortfolioDetailPage({ params }: Props) {
  const { id } = await params;
  const detail = await fetchPortfolioDetail(id);
  if (!detail) notFound();

  const snap = detail.latestSnapshot;
  const color = PORTFOLIO_COLORS[id] ?? '#5a6b82';
  const label = PORTFOLIO_LABELS[id] ?? id;

  const currentPie = detail.holdings.map(h => ({
    ticker: h.ticker,
    name: h.name,
    weight: h.current_weight,
  }));
  const inceptionPie = detail.holdings.map(h => ({
    ticker: h.ticker,
    name: h.name,
    weight: h.target_weight,
  }));

  return (
    <main className="page">
      <Disclaimer />

      <a href="/" className="detail-back">← Tous les portefeuilles</a>

      <div className="detail-header">
        <span className={`card-badge badge-${id}`}>{label}</span>
        <h1 className="detail-title" style={{ marginTop: '0.75rem' }}>{detail.name}</h1>
        {detail.description && (
          <p className="detail-description">{detail.description}</p>
        )}
        {snap && (
          <p className="detail-description" style={{ marginTop: '0.25rem' }}>
            Au {formatDate(snap.date)} · Depuis le {formatDate(detail.inception_date)}
          </p>
        )}
      </div>

      <section aria-label="Indicateurs clés">
        <div className="stats-grid">
          <div className="stat-box">
            <span className="stat-label">Valeur</span>
            <span className="stat-value mono">
              {formatUSD(snap?.value_usd)}
            </span>
          </div>
          <div className="stat-box">
            <span className="stat-label">Perf. depuis le {formatDate(detail.inception_date)}</span>
            <span className={`stat-value mono ${snap && snap.perf_cumul >= 0 ? 'positive' : snap ? 'negative' : ''}`}>
              {formatPct(snap?.perf_cumul)}
            </span>
          </div>
          <div className="stat-box">
            <span className="stat-label">Vol. 30j (ann.)</span>
            <span className="stat-value mono">{formatPct(snap?.vol_30d)}</span>
          </div>
          <div className="stat-box">
            <span className="stat-label">Vol. 90j (ann.)</span>
            <span className="stat-value mono">{formatPct(snap?.vol_90d)}</span>
          </div>
          <div className="stat-box">
            <span className="stat-label">Max drawdown</span>
            <span className="stat-value mono negative">{formatPct(snap?.max_drawdown)}</span>
          </div>
          <div className="stat-box">
            <span className="stat-label">Meilleur jour</span>
            <span className="stat-value mono positive">
              {detail.bestDay ? formatPct(detail.bestDay.return) : '—'}
            </span>
            {detail.bestDay && (
              <span className="stat-label" style={{ marginTop: '0.2rem' }}>
                {formatDate(detail.bestDay.date)}
              </span>
            )}
          </div>
          <div className="stat-box">
            <span className="stat-label">Pire jour</span>
            <span className="stat-value mono negative">
              {detail.worstDay ? formatPct(detail.worstDay.return) : '—'}
            </span>
            {detail.worstDay && (
              <span className="stat-label" style={{ marginTop: '0.2rem' }}>
                {formatDate(detail.worstDay.date)}
              </span>
            )}
          </div>
        </div>
      </section>

      <section className="section" aria-label="Évolution vs benchmark">
        <h2 className="section-title">Évolution — base 100 vs VanEck UCITS</h2>
        <div className="chart-container">
          <DetailChart
            data={detail.chartData}
            portfolioLabel={label}
            portfolioColor={color}
          />
        </div>
        <p className="chart-note">
          Base 100 depuis le {formatDate(detail.inception_date)} · Benchmark en tirets : VanEck Quantum Computing UCITS ETF (QNTM.L)
        </p>
      </section>

      <section className="section" aria-label="Allocation">
        <h2 className="section-title">Allocation</h2>
        <div className="chart-container">
          <AllocationPie
            current={currentPie}
            inception={inceptionPie}
            inceptionDateLabel={formatDate(detail.inception_date)}
          />
        </div>
      </section>

      <section className="section" aria-label="Composition">
        <h2 className="section-title">Composition</h2>
        <div className="chart-container" style={{ padding: '0' }}>
          <HoldingsTable holdings={detail.holdings} inceptionDate={detail.inception_date} />
        </div>
      </section>
    </main>
  );
}
