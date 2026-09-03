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
  // ⚠ MIROIR de `hasDilution` dans societe/[ticker]/page.tsx : les deux conditions
  // doivent bouger ensemble, sinon un encart rend sous un titre « bientôt ».
  if (series.length === 0 && !fin && data.filings.length === 0 && data.warrants.length === 0) {
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

      {/* ── Résultat comptable vs trésorerie ──────────────────────────────
          Distinction PÉDAGOGIQUE et FACTUELLE. On ne dit jamais que la perte
          « ne compte pas » : on dit ce qu'elle contient. Chez IonQ au T2 2026,
          1 649 115 k$ des 1 867 742 k$ de perte sont une revalorisation de
          warrants — publier la perte seule laisserait lire une hémorragie de
          trésorerie là où le runway ci-dessus est intact. ── */}
      {fin?.net_loss != null && (
        <>
          <h3 className="dil-subtitle">{d.resultatTitre}</h3>
          <p className="dil-meta">{d.resultatIntro}</p>
          <div className="dil-metrics">
            <div className="dil-metric">
              <span className="stat-label">{d.resultatPerte}</span>
              <span className="stat-value mono">
                {fin.net_loss < 0 ? '−' : '+'}
                {formatMarketCap(Math.abs(fin.net_loss) * 1000)}
              </span>
              {fin.period_start && fin.period_end && (
                <span className="stat-label dil-meta">
                  {fill(d.consommationDetail, {
                    debut: formatDateCompact(fin.period_start),
                    fin: formatDateCompact(fin.period_end),
                  })}
                </span>
              )}
            </div>

            {fin.warrant_fv_change != null && (
              <div className="dil-metric">
                <span className="stat-label">{d.resultatNonCash}</span>
                <span className="stat-value mono">
                  {formatMarketCap(Math.abs(fin.warrant_fv_change) * 1000)}
                </span>
                <span className="stat-label dil-meta">{d.resultatNonCashDetail}</span>
              </div>
            )}

            {fin.warrant_liability != null && (
              <div className="dil-metric">
                <span className="stat-label">{d.resultatPassif}</span>
                <span className="stat-value mono">
                  {formatMarketCap(fin.warrant_liability * 1000)}
                </span>
                <span className="stat-label dil-meta">{d.resultatPassifDetail}</span>
              </div>
            )}
          </div>
          <p className="dil-meta">{d.resultatExplication}</p>
        </>
      )}

      {/* ── Instruments pouvant créer des actions nouvelles ────────────────
          ⚠ RÈGLE §10 — AUCUN TOTAL, et ne jamais en ajouter un. Chez IonQ les
          strikes vont de 11,50 $ à 155,00 $ : les sommer supposerait qu'ils
          seront tous exercés, c'est-à-dire publier une projection de cours
          déguisée en fait. Les lignes sont listées, jamais agrégées. ── */}
      {data.warrants.length > 0 && (
        <>
          <h3 className="dil-subtitle">{d.instrumentsTitre}</h3>
          <p className="dil-meta">{d.instrumentsIntro}</p>
          <ul className="dil-instruments">
            {data.warrants.map(w => (
              <li key={w.series} className="dil-instrument">
                <div className="dil-instrument-head">
                  <span className="dil-instrument-label">{w.label}</span>
                  <span className="dil-instrument-figures mono">
                    {w.shares_callable != null
                      ? formatShares(w.shares_callable)
                      : d.instrumentNombreInconnu}
                    {' · '}
                    {w.strike_usd.toFixed(2).replace('.', ',')} $
                  </span>
                </div>
                <p className="dil-meta">
                  {w.expires_on
                    ? `${d.instrumentsColonnes.echeance} : ${formatDateCompact(w.expires_on)}`
                    : `${d.instrumentsColonnes.echeance} : ${d.instrumentSansEcheance}`}
                  {' · '}
                  {fill(d.instrumentReleve, { date: formatDateCompact(w.as_of_date) })}
                </p>
                {w.is_derived && w.derivation_note && (
                  <p className="dil-meta dil-derived">
                    <strong>{d.instrumentDerive} </strong>{w.derivation_note}
                  </p>
                )}
                {w.note && <p className="dil-meta">{w.note}</p>}
                <p className="dil-meta dil-source">
                  <a href={w.source_url} target="_blank" rel="noopener noreferrer">
                    {fill(d.sourceDepot, {
                      form: w.source_form,
                      date: formatDateCompact(w.source_filed),
                    })}
                  </a>
                </p>
              </li>
            ))}
          </ul>
          {/* Repère de proportion — le nombre d'actions en circulation, à côté et
              non additionné. Le lecteur rapporte lui-même chaque ligne à ce total. */}
          {data.shares != null && data.shares_date && (
            <p className="dil-meta">
              {fill(d.instrumentPartRappel, {
                societe: data.name,
                actions: formatShares(data.shares),
                date: formatDateCompact(data.shares_date),
              })}
            </p>
          )}
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
