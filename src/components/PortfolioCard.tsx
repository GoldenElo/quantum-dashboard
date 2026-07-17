import type { PortfolioSummary } from '@/lib/api';
import { formatUSD, formatPct, formatDate } from '@/lib/format';

const PROFILE_LABELS: Record<string, string> = {
  defensif:  'Défensif',
  dynamique: 'Dynamique',
  agressif:  'Agressif',
  personnel: 'Personnel',
};

export default function PortfolioCard({ summary }: { summary: PortfolioSummary }) {
  const { id, name, inception_date, value_usd, perf_cumul, vol_30d, latestDate, isPrivate } = summary;
  const perfSign = perf_cumul == null ? '' : perf_cumul >= 0 ? 'positive' : 'negative';

  return (
    <a
      href={`/portefeuille/${id}`}
      className="portfolio-card"
      aria-label={`Voir le portefeuille ${name}`}
      data-umami-event="clic-detail-portefeuille"
      data-umami-event-portefeuille={id}
    >
      <div className="card-top">
        <span className={`card-badge badge-${id}`}>{PROFILE_LABELS[id] ?? id}</span>
        {latestDate && (
          <span className="card-date">{formatDate(latestDate)}</span>
        )}
      </div>

      <h2 className="card-name">{name}</h2>

      {isPrivate ? (
        <p className="card-private-hint mono">Données privées</p>
      ) : (
        <p className="card-value mono">{formatUSD(value_usd)}</p>
      )}

      <div className="card-stats">
        <div className="card-stat">
          <span className="stat-label">Perf. depuis le {formatDate(inception_date)}</span>
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
