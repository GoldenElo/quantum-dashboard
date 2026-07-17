import type { MarketCapData, MarketCapRow } from '@/lib/api';
import { formatMarketCap, formatDateCompact, formatPct, formatRatio } from '@/lib/format';
import { t, TICKER_NOTES, TICKER_MODALITIES } from '@/i18n/t';

// Seuil de détection "données anciennes" : 150 jours ≈ 5 mois (ex. LAES au 31/12/2025)
const STALE_MS = 1000 * 60 * 60 * 24 * 150;

function isStale(dateStr: string): boolean {
  const [y, m, d] = dateStr.split('-').map(Number);
  return Date.now() - new Date(y, m - 1, d).getTime() > STALE_MS;
}

// Cellule de variation : verte/rouge foncé, « — » si null. `alert` ajoute le ⚑
// (variation exceptionnelle) avec infobulle anti-hype — visible mais discret.
function ChangeCell({ value, alert = false }: { value: number | null; alert?: boolean }) {
  if (value == null) {
    return <td className="right mono mcap-change">—</td>;
  }
  const cls = value >= 0 ? 'mcap-change-pos' : 'mcap-change-neg';
  return (
    <td className={`right mono mcap-change ${cls}`}>
      {formatPct(value)}
      {alert && (
        <span className="mcap-alert" title={t.secteur.variationExceptionnelle}>⚑</span>
      )}
    </td>
  );
}

// Cellule P/S — affichage à DEUX niveaux, marqueurs de nature distincte :
//   ⚠ (valorisation extrême) sur données FIABLES ≠ ‡ (données incertaines).
// Un P/S ferme normal s'affiche sans aucun marqueur. « n.s. » / « — » = pas de ratio.
function PsCell({ row }: { row: MarketCapRow }) {
  switch (row.ps_status) {
    case 'none':
      return <td className="right mono mcap-ps">—</td>;
    case 'insignificant':
      return (
        <td className="right mono mcap-ps mcap-ps-ns" title={t.secteur.ps.insignifiantTooltip}>
          {t.secteur.ps.insignifiant}
        </td>
      );
    case 'firm':
      return <td className="right mono mcap-ps">{formatRatio(row.ps_ratio)}</td>;
    case 'firm_extreme':
      return (
        <td className="right mono mcap-ps">
          {formatRatio(row.ps_ratio)}
          <span className="mcap-ps-extreme" title={t.secteur.ps.extremeTooltip}>
            {t.secteur.ps.extremeMarker}
          </span>
        </td>
      );
    case 'partial':
    case 'unrecouped': {
      const tip = row.ps_status === 'partial' ? t.secteur.ps.partielTooltip : t.secteur.ps.nonRecoupeTooltip;
      return (
        <td className="right mono mcap-ps mcap-ps-uncertain" title={tip}>
          {formatRatio(row.ps_ratio)}
          <span className="mcap-ps-marker">{t.secteur.ps.incertainMarker}</span>
        </td>
      );
    }
  }
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
                <th className="right">{t.secteur.colonnes.ps}</th>
                <th className="right">{t.secteur.colonnes.jour}</th>
                <th className="right">{t.secteur.colonnes.semaine}</th>
                <th className="right">{t.secteur.colonnes.mois}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => {
                const stale = isStale(row.shares_date);
                const note = TICKER_NOTES[row.ticker];
                const modality = TICKER_MODALITIES[row.ticker];
                // Fraîcheur du nb d'actions : déplacée en infobulle sur la market cap
                const mcapTitle =
                  `${t.secteur.actionsTooltip} ${formatDateCompact(row.shares_date)}` +
                  (stale ? ` ${t.secteur.actionsTooltipStale}` : '');
                const ficheHref = `/societe/${row.ticker.toLowerCase()}`;
                return (
                  <tr key={row.ticker}>
                    <td className="name">
                      <a
                        href={ficheHref}
                        className="mcap-fiche-link"
                        aria-label={`${t.societe.lienFicheAria} ${row.name}`}
                        data-umami-event="clic-fiche-societe"
                        data-umami-event-ticker={row.ticker}
                      >
                        {row.name}
                      </a>
                      {modality && <span className="tech-tag">{modality}</span>}
                      {note && <sup className="mcap-fn-marker">{note.marker}</sup>}
                    </td>
                    <td className="ticker">
                      <a href={ficheHref} className="mcap-fiche-link" tabIndex={-1} aria-hidden="true">
                        {row.ticker}
                      </a>
                    </td>
                    <td className="right mono">${row.adj_close.toFixed(2)}</td>
                    <td className="right mono mcap-mcap-cell" title={mcapTitle}>
                      {stale && <span className="mcap-stale-icon" aria-hidden="true">⚠ </span>}
                      {formatMarketCap(row.market_cap_usd)}
                    </td>
                    <PsCell row={row} />
                    <ChangeCell value={row.change_1d} />
                    <ChangeCell value={row.change_1w} alert={row.change_1w_extreme} />
                    <ChangeCell value={row.change_1m} />
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
