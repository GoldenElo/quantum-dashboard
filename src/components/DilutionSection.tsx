import type { CompanyData } from '@/lib/api';
import {
  annualizedDilution,
  comparableSegment,
  isStale,
  runwayQuarters,
  ttmDilution,
  RUNWAY_CAP_QUARTERS,
} from '@/lib/dilution';
import { formatDateCompact, formatMarketCap, formatShares } from '@/lib/format';
import { t } from '@/i18n/t';

/**
 * C7 — section Dilution des fiches sociétés.
 *
 * Server Component, aucun JS client : le mini-graphique est une pile de barres
 * CSS, pas un canevas. Choix délibéré — cinq points annuels ne justifient pas
 * d'embarquer une librairie de graphiques, et des barres restent lisibles sur
 * mobile, où l'audience est majoritaire.
 *
 * RÈGLE §10 (bible éditoriale) : information, jamais recommandation. Aucun score
 * composite, aucun classement « risque de dilution ». Les dépôts déclarés sont
 * nommés par leur FORME EXACTE et jamais qualifiés d'« ATM » — ce serait une
 * inférence habillée en fait.
 */

const fmtPct = (v: number) =>
  `${v >= 0 ? '+' : '−'}${Math.abs(v * 100).toFixed(1).replace('.', ',')} %`;


function fill(template: string, values: Record<string, string>): string {
  return Object.entries(values).reduce((s, [k, v]) => s.replace(`{${k}}`, v), template);
}

export default function DilutionSection({ data }: { data: CompanyData }) {
  const d = t.societe.dilution;
  const { series, breaks } = comparableSegment(data.sharesHistory);
  const annual = annualizedDilution(series);
  const ttm = ttmDilution(series);
  const fin = data.financials;

  // Rien à montrer nulle part : on garde le placeholder « bientôt ». On affiche
  // l'absence, on ne la comble pas (XNDU, HQ, IQMX — XBRL inexploitable).
  if (series.length === 0 && !fin && data.filings.length === 0) {
    return <p className="company-soon">{d.bientot}</p>;
  }

  const maxShares = series.length > 0 ? Math.max(...series.map(p => p.shares)) : 0;
  const runway = fin ? runwayQuarters(fin.liquidity, fin.burn_per_quarter, fin.as_of_date) : null;
  const stale = fin ? isStale(fin.as_of_date) : false;
  const placements = fin ? (fin.invest_current ?? 0) + (fin.invest_noncurrent ?? 0) : 0;

  return (
    <div className="dil">
      {/* ── Historique du nombre d'actions ── */}
      {series.length > 0 && (
        <>
          <h3 className="dil-subtitle">{d.historiqueTitre}</h3>

          {breaks.map(b => (
            <p key={b.to.date} className="dil-break">
              ⚑ {fill(d.rupture, { date: formatDateCompact(b.to.date) })}
            </p>
          ))}

          <ul className="dil-bars">
            {series.map(p => (
              <li key={p.date} className="dil-bar-row">
                <span className="dil-bar-label mono">{p.date.slice(0, 4)}</span>
                <span className="dil-bar-track">
                  <span
                    className="dil-bar-fill"
                    style={{ width: `${Math.max(2, (p.shares / maxShares) * 100)}%` }}
                  />
                </span>
                <span className="dil-bar-value mono">{formatShares(p.shares)}</span>
              </li>
            ))}
          </ul>

          {annual ? (
            <div className="dil-metrics">
              <div className="dil-metric">
                <span className="stat-label">{d.annualisee}</span>
                <span className="stat-value mono dil-rate">{fmtPct(annual.rate)}</span>
                <span className="stat-label dil-meta">
                  {fill(d.annualiseeDetail, {
                    annees: annual.years.toFixed(1).replace('.', ','),
                    debut: formatDateCompact(series[0].date),
                    fin: formatDateCompact(series[series.length - 1].date),
                  })}
                </span>
              </div>
              {ttm && (
                <div className="dil-metric">
                  <span className="stat-label">{d.recente}</span>
                  <span className="stat-value mono dil-rate">{fmtPct(ttm.rate)}</span>
                  <span className="stat-label dil-meta">
                    {fill(d.recenteDetail, {
                      jours: String(ttm.days),
                      debut: formatDateCompact(ttm.from.date),
                    })}
                  </span>
                </div>
              )}
              <div className="dil-metric">
                <span className="stat-label">
                  {fill(d.multiple, {
                    facteur: (series[series.length - 1].shares / series[0].shares)
                      .toFixed(2)
                      .replace('.', ','),
                  })}
                </span>
              </div>
            </div>
          ) : (
            <p className="dil-meta">{d.unSeulReleve}</p>
          )}
        </>
      )}

      {/* ── Liquidités, consommation, autonomie ── */}
      {fin && (
        <>
          <h3 className="dil-subtitle">{d.liquiditesTitre}</h3>
          <div className="dil-metrics">
            <div className="dil-metric">
              <span className="stat-label">{d.liquidites}</span>
              <span className="stat-value mono">{formatMarketCap(fin.liquidity)}</span>
              <span className="stat-label dil-meta">
                {placements > 0
                  ? fill(d.liquiditesDetail, {
                      tresorerie: formatMarketCap(fin.cash),
                      placements: formatMarketCap(placements),
                    })
                  : d.liquiditesDetailSansPlacement}
              </span>
            </div>

            {fin.burn_per_quarter != null && (
              <div className="dil-metric">
                <span className="stat-label">{d.consommation}</span>
                {/* Consommation : signe explicite « − », valeur absolue formatée.
                    formatMarketCap n'est calibré que pour des montants positifs. */}
                <span className="stat-value mono">
                  {fin.burn_per_quarter < 0 ? '−' : '+'}
                  {formatMarketCap(Math.abs(fin.burn_per_quarter))}
                </span>
                <span className="stat-label dil-meta">
                  {fin.period_start && fin.period_end
                    ? fill(d.consommationDetail, {
                        debut: formatDateCompact(fin.period_start),
                        fin: formatDateCompact(fin.period_end),
                      })
                    : ''}
                </span>
              </div>
            )}

            <div className="dil-metric">
              <span className="stat-label">{d.runway}</span>
              <span className="stat-value dil-runway">
                {runway == null
                  ? fill(d.runwayIndisponible, { date: formatDateCompact(fin.as_of_date) })
                  : runway > RUNWAY_CAP_QUARTERS
                    ? d.runwayPlafonne
                    : fill(d.runwayValeur, { trimestres: String(Math.round(runway)) })}
              </span>
            </div>
          </div>

          <p className="dil-meta dil-source">
            {fill(d.donneesAu, { date: formatDateCompact(fin.as_of_date) })}
            {stale && <span className="dil-stale"> {d.donneesAnciennes}</span>}
            {' · '}
            <a href={fin.source_url} target="_blank" rel="noopener noreferrer">
              {fill(d.sourceDepot, {
                form: fin.source_form,
                date: formatDateCompact(fin.source_filed),
              })}
            </a>
          </p>
        </>
      )}

      {/* ── Dépôts déclarés — faits datés, nommés par leur forme exacte ── */}
      {data.filings.length > 0 && (
        <>
          <h3 className="dil-subtitle">{d.depotsTitre}</h3>
          <p className="dil-meta">{d.depotsIntro}</p>
          <ul className="dil-filings">
            {data.filings.map(f => (
              <li key={f.url}>
                <a href={f.url} target="_blank" rel="noopener noreferrer">
                  <span className="dil-filing-form mono">{f.form}</span>
                  <span className="mono"> {formatDateCompact(f.filed)}</span> ↗
                </a>
              </li>
            ))}
          </ul>
        </>
      )}

      <p className="chart-note dil-methode">
        <strong>{d.methodeTitre} — </strong>
        {d.methode}
      </p>
    </div>
  );
}
