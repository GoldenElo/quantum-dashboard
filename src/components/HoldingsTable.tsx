import type { HoldingRow } from '@/lib/api';
import { formatPct, formatDate } from '@/lib/format';

const CATEGORY_LABELS: Record<string, string> = {
  geant: 'Géant',
  infrastructure: 'Infrastructure',
  pure_player: 'Pure-player',
  etf: 'ETF',
};

export default function HoldingsTable({
  holdings,
  inceptionDate,
}: {
  holdings: HoldingRow[];
  inceptionDate: string;
}) {
  if (holdings.length === 0) {
    return <p className="empty-state">Aucune position disponible.</p>;
  }

  return (
    <div className="table-wrapper">
      <table className="holdings-table">
        <thead>
          <tr>
            <th>Ticker</th>
            <th>Société</th>
            <th className="hide-mobile">Catégorie</th>
            <th className="right">Poids actuel</th>
            <th className="right hide-mobile">Poids initial</th>
            <th className="right">Perf. depuis le {formatDate(inceptionDate)}</th>
          </tr>
        </thead>
        <tbody>
          {holdings.map(h => {
            const perfSign = h.perf_since_inception == null
              ? ''
              : h.perf_since_inception >= 0 ? 'positive' : 'negative';
            return (
              <tr key={h.ticker}>
                <td className="ticker mono">{h.ticker}</td>
                <td className="name">{h.name}</td>
                <td className="hide-mobile">
                  <span className="category-badge">{CATEGORY_LABELS[h.category] ?? h.category}</span>
                </td>
                <td className="right mono">{formatPct(h.current_weight)}</td>
                <td className="right mono hide-mobile">{formatPct(h.target_weight)}</td>
                <td className={`right mono ${perfSign}`}>{formatPct(h.perf_since_inception)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
