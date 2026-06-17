import type { MarketCapData } from '@/lib/api';
import { formatMarketCap, formatDateCompact } from '@/lib/format';
import { t, TICKER_NOTES, TICKER_MODALITIES } from '@/i18n/t';

// Seuil de détection "données anciennes" : 150 jours ≈ 5 mois (ex. LAES au 31/12/2025)
const STALE_MS = 1000 * 60 * 60 * 24 * 150;

function isStale(dateStr: string): boolean {
  const [y, m, d] = dateStr.split('-').map(Number);
  return Date.now() - new Date(y, m - 1, d).getTime() > STALE_MS;
}

export default function MarketCapTable({ data }: { data: MarketCapData }) {
  const { rows, pure_player_total_usd } = data;

  // Footnotes dans l'ordre d'apparition des lignes (tri market cap DESC)
  const footnoteTickers = rows.filter(r => TICKER_NOTES[r.ticker]).map(r => r.ticker);

  return (
    <section className="section" aria-label={t.secteur.titre}>
      <h2 className="section-title">{t.secteur.titre}</h2>

      <div className="chart-container" style={{ padding: 0 }}>

        {/* Encart total pure-players */}
        <div className="mcap-summary">
          <span className="mcap-summary-label">{t.secteur.totalPurePlayers.libelle}</span>
          <span className="mcap-summary-value">{formatMarketCap(pure_player_total_usd)}</span>
          <span className="mcap-summary-note">{t.secteur.totalPurePlayers.note}</span>
        </div>

        {/* Tableau des 12 sociétés */}
        <div className="table-wrapper">
          <table className="holdings-table">
            <thead>
              <tr>
                <th>{t.secteur.colonnes.societe}</th>
                <th>{t.secteur.colonnes.ticker}</th>
                <th className="right">{t.secteur.colonnes.cours}</th>
                <th className="right">{t.secteur.colonnes.capitalisation}</th>
                <th className="right">{t.secteur.colonnes.actionsAu}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => {
                const stale = isStale(row.shares_date);
                const note = TICKER_NOTES[row.ticker];
                const modality = TICKER_MODALITIES[row.ticker];
                return (
                  <tr key={row.ticker}>
                    <td className="name">
                      {row.name}
                      {modality && <span className="tech-tag">{modality}</span>}
                      {note && <sup className="mcap-fn-marker">{note.marker}</sup>}
                    </td>
                    <td className="ticker">{row.ticker}</td>
                    <td className="right mono">${row.adj_close.toFixed(2)}</td>
                    <td className="right mono">{formatMarketCap(row.market_cap_usd)}</td>
                    <td className={`right mcap-date${stale ? ' mcap-date-stale' : ''}`}>
                      {stale && (
                        <span className="mcap-stale-icon" title="Données datant de plus de 5 mois">⚠ </span>
                      )}
                      {formatDateCompact(row.shares_date)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Notes de bas de tableau dynamiques */}
        {footnoteTickers.length > 0 && (
          <div className="mcap-footnotes">
            {footnoteTickers.map(ticker => (
              <p key={ticker} className="mcap-footnote">
                <sup>{TICKER_NOTES[ticker].marker}</sup> {ticker} — {TICKER_NOTES[ticker].text}
              </p>
            ))}
          </div>
        )}

        {/* Disclaimer */}
        <p className="mcap-disclaimer">{t.secteur.disclaimer}</p>

      </div>
    </section>
  );
}
