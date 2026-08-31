import type { MarketCapData, MarketCapRow } from '@/lib/api';
import { formatMarketCap, formatPct } from '@/lib/format';
import { t, TICKER_NOTES, TICKER_MODALITIES } from '@/i18n/t';
import { psPresentation, sharesFreshness, marketCapPresentation } from '@/lib/marketCapPresentation';
import MarketCapMobileList from './MarketCapMobileList';

// Les règles d'affichage (états P/S, fraîcheur du nombre d'actions, seuil de
// 150 j) vivent dans src/lib/marketCapPresentation.ts — SOURCE UNIQUE partagée
// avec la vue mobile (D4). Ce fichier ne décide plus quoi dire, seulement
// comment le baliser en `<td>`.

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
  const ps = psPresentation(row);
  const stateClass =
    ps.markerKind === 'uncertain'
      ? ' mcap-ps-uncertain'
      : ps.markerKind === 'insignificant'
        ? ' mcap-ps-ns'
        : '';
  // Le ⚠ « valorisation extrême » porte SON infobulle sur le marqueur seul (la
  // valeur, elle, est fiable) ; le ‡ et le « n.s. » qualifient la donnée entière
  // et portent la leur sur la cellule. Placement identique à l'avant-D4.
  const extreme = ps.markerKind === 'extreme';
  return (
    <td className={`right mono mcap-ps${stateClass}`} title={extreme ? undefined : ps.note ?? undefined}>
      {ps.text}
      {ps.marker && (
        <span
          className={extreme ? 'mcap-ps-extreme' : 'mcap-ps-marker'}
          title={extreme ? ps.note ?? undefined : undefined}
        >
          {ps.marker}
        </span>
      )}
    </td>
  );
}

export default function MarketCapTable({ data }: { data: MarketCapData }) {
  const { rows, pure_player_total_usd, pure_player_excluded } = data;

  // Footnotes dans l'ordre d'apparition des lignes (tri market cap DESC)
  const footnoteTickers = rows.filter(r => TICKER_NOTES[r.ticker]).map(r => r.ticker);

  return (
    <section className="section" aria-label={t.secteur.titre}>
      <h2 className="section-title">{t.secteur.titre}</h2>

      <div className="chart-container" style={{ padding: 0 }}>

        {/* Encart total pure-players — HORS des deux vues : visible dans les deux */}
        <div className="mcap-summary">
          <span className="mcap-summary-label">{t.secteur.totalPurePlayers.libelle}</span>
          <span className="mcap-summary-value">{formatMarketCap(pure_player_total_usd)}</span>
          <span className="mcap-summary-note">
            {t.secteur.totalPurePlayers.note}
            {/* Un total qui tait ce qu'il n'a pas pu compter se présente comme
                exhaustif sans l'être. Les exclus sont nommés, pas sous-entendus. */}
            {pure_player_excluded.length > 0 && (
              <>
                {' · '}
                {t.secteur.totalPurePlayers.exclusPrefix} {pure_player_excluded.join(' · ')}{' '}
                {t.secteur.totalPurePlayers.exclusSuffixe}
              </>
            )}
          </span>
        </div>

        {/* D4 — deux arbres DOM, le CSS choisit lequel s'affiche (idiome déjà
            retenu pour ThemeToggle). Aucun flash d'hydratation, et l'arbre caché
            par `display:none` sort de l'ordre de tabulation : pas de piège clavier. */}
        <div className="mcap-desktop">
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
                  const { stale } = sharesFreshness(row);
                  const mcap = marketCapPresentation(row);
                  const note = TICKER_NOTES[row.ticker];
                  const modality = TICKER_MODALITIES[row.ticker];
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
                      <td className="right mono mcap-mcap-cell" title={mcap.note ?? undefined}>
                        {stale && <span className="mcap-stale-icon" aria-hidden="true">⚠ </span>}
                        {mcap.text}
                        {mcap.marker && (
                          <sup className="mcap-fn-marker" aria-hidden="true">{mcap.marker}</sup>
                        )}
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
        </div>

        <div className="mcap-mobile">
          <MarketCapMobileList rows={rows} />
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
