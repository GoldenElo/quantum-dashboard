import type { HoldingRow } from '@/lib/api';
import { formatUSD, formatPct, formatQty } from '@/lib/format';

const CATEGORY_LABELS: Record<string, string> = {
  geant: 'Géant',
  infrastructure: 'Infrastructure',
  pure_player: 'Pure-player',
  etf: 'ETF',
};

export default function HoldingsTable({ holdings }: { holdings: HoldingRow[] }) {
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
            <th className="right">Quantité</th>
            <th className="right">Prix</th>
            <th className="right">Valeur</th>
            <th className="right">Poids actuel</th>
            <th className="right hide-mobile">Poids inception</th>
            <th className="right">Contribution</th>
          </tr>
        </thead>
        <tbody>
          {holdings.map(h => {
            const contribSign = h.perf_contribution >= 0 ? 'positive' : 'negative';
            return (
              <tr key={h.ticker}>
                <td className="ticker mono">{h.ticker}</td>
                <td className="name">{h.name}</td>
                <td className="hide-mobile">
                  <span className="category-badge">{CATEGORY_LABELS[h.category] ?? h.category}</span>
                </td>
                <td className="right mono">{formatQty(h.quantity)}</td>
                <td className="right mono">{formatUSD(h.adj_close)}</td>
                <td className="right mono">{formatUSD(h.value_usd)}</td>
                <td className="right mono">{formatPct(h.current_weight)}</td>
                <td className="right mono hide-mobile">{formatPct(h.target_weight)}</td>
                <td className={`right mono ${contribSign}`}>{formatPct(h.perf_contribution)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
