import type { PortfolioSummary } from '@/lib/api';
import { formatUSD, formatPct, formatDate } from '@/lib/format';

const PROFILE_LABELS: Record<string, string> = {
  defensif: 'Défensif',
  dynamique: 'Dynamique',
  agressif: 'Agressif',
};

export default function PortfolioCard({ summary }: { summary: PortfolioSummary }) {
  const { id, name, value_usd, perf_cumul, vol_30d, latestDate } = summary;
  const perfSign = perf_cumul == null ? '' : perf_cumul >= 0 ? 'positive' : 'negative';

  return (
    <a href={`/portefeuille/${id}`} className="portfolio-card" aria-label={`Voir le portefeuille ${name}`}>
      <div className="card-top">
        <span className={`card-badge badge-${id}`}>{PROFILE_LABELS[id] ?? id}</span>
        {latestDate && (
          <span className="card-date">{formatDate(latestDate)}</span>
        )}
      </div>

      <h2 className="card-name">{name}</h2>

      <p className={`card-value mono ${perfSign}`}>{formatUSD(value_usd)}</p>

      <div className="card-stats">
        <div className="card-stat">
          <span className="stat-label">Perf. depuis l&apos;inception</span>
          <span className={`stat-value mono ${perfSign}`}>{formatPct(perf_cumul)}</span>
        </div>
        <div className="card-stat">
          <span className="stat-label">Vol. 30j</span>
          <span className="stat-value mono">{formatPct(vol_30d)}</span>
        </div>
      </div>

      <span className="card-cta">Voir le détail →</span>
    </a>
  );
}
