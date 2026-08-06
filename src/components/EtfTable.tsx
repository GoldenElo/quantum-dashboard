import type { EtfQuantique } from '@/data/etf-quantiques';
import { formatMarketCap, formatDateCompact } from '@/lib/format';
import { t } from '@/i18n/t';

const terFmt = new Intl.NumberFormat('fr-FR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

// Date de relevé : ISO quand le jour est connu (2026-08-04 → 4 juin 2026), sinon
// le libellé tel que publié par la source (« mi-2026 »). On n'invente jamais une
// précision que la source ne donne pas.
function formatReleve(date: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? formatDateCompact(date) : date;
}

// Donnée non vérifiée — affichée comme telle, jamais remplacée par une estimation.
function AVerifier({ tooltip }: { tooltip: string }) {
  return (
    <span className="etf-unknown" title={tooltip}>
      {t.etf.aVerifier}
    </span>
  );
}

function EncoursCell({ etf }: { etf: EtfQuantique }) {
  if (etf.encoursMusd == null) {
    return (
      <td className="etf-cell-num" data-label={t.etf.colonnes.encours}>
        <AVerifier tooltip={t.etf.aVerifierTooltip} />
      </td>
    );
  }
  return (
    <td className="etf-cell-num" data-label={t.etf.colonnes.encours}>
      <span className="etf-value mono">
        {etf.encoursApprox && '~'}
        {formatMarketCap(etf.encoursMusd * 1e6)}
      </span>
      {/* Règle du Wall : aucun chiffre sans sa date de relevé. */}
      <span className="etf-asof mono">
        {t.etf.relevePrefix} {formatReleve(etf.encoursDate)}
      </span>
      {etf.encoursARecouper && (
        <span className="etf-flag" title={t.etf.aRecouperTooltip}>{t.etf.aRecouper}</span>
      )}
    </td>
  );
}

function TerCell({ etf }: { etf: EtfQuantique }) {
  return (
    <td className="etf-cell-num" data-label={t.etf.colonnes.ter}>
      {etf.terPct == null ? (
        <AVerifier tooltip={t.etf.aVerifierTooltip} />
      ) : (
        <>
          {/* Espace insécable : « 0,50 % » ne doit jamais se couper en fin de ligne */}
          <span className="etf-value mono">{terFmt.format(etf.terPct)}&#8239;%</span>
          {etf.terAVerifier && (
            <span className="etf-flag" title={t.etf.terAVerifierTooltip}>{t.etf.aVerifier}</span>
          )}
        </>
      )}
    </td>
  );
}

function AccessCell({ etf }: { etf: EtfQuantique }) {
  return (
    <td data-label={t.etf.colonnes.accessible}>
      <span className={`etf-access ${etf.accessibleEurope ? 'etf-access-yes' : 'etf-access-no'}`}>
        <span aria-hidden="true">{etf.accessibleEurope ? '✅' : '❌'}</span>{' '}
        {etf.accessibleEurope ? t.etf.accessibleOui : t.etf.accessibleNon}
      </span>
      {etf.accessibleEuropeNote && (
        <span className="etf-access-note">{etf.accessibleEuropeNote}</span>
      )}
    </td>
  );
}

// Un seul rendu de tableau, réutilisé pour le bloc principal et la section Corée :
// mêmes colonnes, mêmes règles d'affichage, aucune divergence possible.
export default function EtfTable({ items, ariaLabel }: { items: EtfQuantique[]; ariaLabel: string }) {
  return (
    <div className="table-wrapper">
      <table className="holdings-table etf-table" aria-label={ariaLabel}>
        <thead>
          <tr>
            <th>{t.etf.colonnes.etf}</th>
            <th>{t.etf.colonnes.ticker}</th>
            <th>{t.etf.colonnes.bourse}</th>
            <th>{t.etf.colonnes.lancement}</th>
            <th>{t.etf.colonnes.encours}</th>
            <th>{t.etf.colonnes.ter}</th>
            <th>{t.etf.colonnes.composition}</th>
            <th>{t.etf.colonnes.accessible}</th>
          </tr>
        </thead>
        <tbody>
          {items.map(etf => (
            <tr key={`${etf.ticker}-${etf.bourse}`} className={etf.sujetVideo ? 'etf-row-focus' : undefined}>
              <td className="name etf-cell-name">
                {etf.sujetVideo && (
                  <span className="etf-focus-marker" aria-label={t.etf.aria.sujetVideo}>
                    {t.etf.sujetVideoMarker}
                  </span>
                )}
                {etf.nom}
              </td>
              <td data-label={t.etf.colonnes.ticker}>
                <span className="etf-ticker mono">{etf.ticker}</span>
                {etf.isin && <span className="etf-isin mono">{etf.isin}</span>}
              </td>
              <td data-label={t.etf.colonnes.bourse}>{etf.bourse}</td>
              <td className="mono etf-cell-date" data-label={t.etf.colonnes.lancement}>{etf.lancement}</td>
              <EncoursCell etf={etf} />
              <TerCell etf={etf} />
              <td className="etf-cell-compo" data-label={t.etf.colonnes.composition}>{etf.composition}</td>
              <AccessCell etf={etf} />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
