import { formatMarketCap, formatDate } from '@/lib/format';
import { t, TICKER_NOTES } from '@/i18n/t';
import type { IndexConstituent } from '@/lib/api';

type Props = { constituents: IndexConstituent[]; lastRebalance: string };

// Poids en pourcentage — 2 décimales, virgule française, jamais de signe.
function pct(value: number): string {
  return `${(value * 100).toFixed(2).replace('.', ',')} %`;
}

// Dérive en POINTS de pourcentage (pas en %) — un poids qui passe de 25 % à
// 26 % gagne 1 point, pas 1 %. La distinction évite une lecture fausse.
function drift(current: number, atRebalance: number): string {
  const points = (current - atRebalance) * 100;
  const sign = points >= 0 ? '+' : '−';
  return `${sign}${Math.abs(points).toFixed(2).replace('.', ',')} pt`;
}

export default function IndexConstituentsTable({ constituents, lastRebalance }: Props) {
  if (constituents.length === 0) return null;

  const totalCap = constituents.reduce((sum, c) => sum + c.market_cap_usd, 0);
  const totalRebalance = constituents.reduce((sum, c) => sum + c.weight_at_rebalance, 0);
  const totalCurrent = constituents.reduce((sum, c) => sum + c.weight_current, 0);

  // Notes de bas de tableau, dans l'ordre d'apparition des lignes.
  const footnoteTickers = constituents
    .map(c => c.ticker)
    .filter(ticker => TICKER_NOTES[ticker]);

  return (
    <section className="section" aria-label={t.indice.constituants.titre}>
      <h2 className="section-title">{t.indice.constituants.titre}</h2>

      <div className="chart-container" style={{ padding: 0 }}>
        <div className="table-wrapper">
          <table className="holdings-table">
            <thead>
              <tr>
                <th>{t.indice.constituants.colonnes.societe}</th>
                <th className="hide-mobile">{t.indice.constituants.colonnes.ticker}</th>
                <th className="right hide-mobile">{t.indice.constituants.colonnes.cours}</th>
                <th className="right">{t.indice.constituants.colonnes.capitalisation}</th>
                <th className="right">{t.indice.constituants.colonnes.poidsRebalancement}</th>
                <th className="right">{t.indice.constituants.colonnes.poidsCourant}</th>
                <th className="right hide-mobile">{t.indice.constituants.colonnes.derive}</th>
              </tr>
            </thead>
            <tbody>
              {constituents.map(c => {
                const note = TICKER_NOTES[c.ticker];
                return (
                  <tr key={c.ticker}>
                    <td className="name">
                      <a
                        href={`/societe/${c.ticker.toLowerCase()}`}
                        className="mcap-fiche-link"
                        aria-label={`${t.societe.lienFicheAria} ${c.name}`}
                        data-umami-event="clic-fiche-societe"
                        data-umami-event-ticker={c.ticker}
                      >
                        {c.name}
                      </a>
                      {note && <sup className="mcap-fn-marker">{note.marker}</sup>}
                    </td>
                    <td className="ticker mono hide-mobile">{c.ticker}</td>
                    <td className="right mono hide-mobile">${c.adj_close.toFixed(2)}</td>
                    <td
                      className="right mono mcap-mcap-cell"
                      title={`${t.indice.constituants.sourceActionsPrefix} ${c.shares_source}`}
                    >
                      {formatMarketCap(c.market_cap_usd)}
                    </td>
                    <td className="right mono">
                      {pct(c.weight_at_rebalance)}
                      {c.capped_at_rebalance && (
                        <span
                          className="indice-capped-marker"
                          title={t.indice.constituants.plafonneeTooltip}
                        >
                          {' '}{t.indice.constituants.plafonneeMarker}
                        </span>
                      )}
                    </td>
                    <td className="right mono">
                      {pct(c.weight_current)}
                      {c.over_cap_now && (
                        <span
                          className="mcap-alert"
                          title={t.indice.constituants.derivePlafondTooltip}
                        >
                          {' '}{t.indice.constituants.derivePlafondMarker}
                        </span>
                      )}
                    </td>
                    <td className="right mono indice-drift hide-mobile">
                      {drift(c.weight_current, c.weight_at_rebalance)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td className="name">{t.indice.constituants.total}</td>
                <td className="hide-mobile" />
                <td className="hide-mobile" />
                <td className="right mono">{formatMarketCap(totalCap)}</td>
                <td className="right mono">{pct(totalRebalance)}</td>
                <td className="right mono">{pct(totalCurrent)}</td>
                <td className="hide-mobile" />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Clé de lecture des DEUX colonnes de poids — affichée, pas cachée en infobulle */}
      <p className="chart-note">
        {t.indice.constituants.explication.replace('{date}', formatDate(lastRebalance))}
      </p>

      {footnoteTickers.length > 0 && (
        <div className="mcap-footnotes">
          {footnoteTickers.map(ticker => (
            <p key={ticker} className="mcap-footnote">
              <sup>{TICKER_NOTES[ticker].marker}</sup> {ticker} — {TICKER_NOTES[ticker].text}
            </p>
          ))}
        </div>
      )}
    </section>
  );
}
