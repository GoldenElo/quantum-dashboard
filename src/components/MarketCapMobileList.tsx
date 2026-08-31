'use client';

import { useState } from 'react';
import type { MarketCapRow } from '@/lib/api';
import { formatDateCompact, formatPct, formatShares } from '@/lib/format';
import { t, TICKER_NOTES, TICKER_MODALITIES } from '@/i18n/t';
import { changeTone, psPresentation, sharesFreshness, marketCapPresentation } from '@/lib/marketCapPresentation';
import { trackEvent } from '@/lib/umami';

/**
 * D4 — vue mobile du tableau des capitalisations (sous 960px).
 *
 * Pattern : trois colonnes essentielles (Société · Capitalisation · Var. jour),
 * le reste au tap dans un panneau déplié. Remplace le défilement horizontal,
 * qui masquait cinq colonnes sur huit à l'audience majoritairement mobile.
 *
 * Ce composant est le SEUL de la brique à être client, et pour une seule
 * raison : l'exclusivité « un panneau ouvert à la fois » et un événement Umami
 * émis à l'ouverture SEULEMENT. Un `<details name>` natif aurait donné
 * l'exclusivité sans JavaScript, mais `data-umami-event` s'y déclenche aussi à
 * la fermeture — la métrique aurait doublé sans que rien ne le signale.
 *
 * Les valeurs, marqueurs et avertissements viennent de
 * `src/lib/marketCapPresentation.ts`, partagé avec le rendu desktop : les deux
 * vues ne peuvent pas diverger.
 */

function ChangeValue({ value, alert = false }: { value: number | null; alert?: boolean }) {
  const tone = changeTone(value);
  if (tone === null) return <span className="mono mcap-change">—</span>;
  return (
    <span className={`mono mcap-change mcap-change-${tone === 'pos' ? 'pos' : 'neg'}`}>
      {formatPct(value)}
      {alert && <span className="mcap-alert" aria-hidden="true"> ⚑</span>}
    </span>
  );
}

/** Une ligne du panneau : libellé à gauche, valeur à droite, note dessous. */
function PanelRow({
  label,
  children,
  note,
}: {
  label: string;
  children: React.ReactNode;
  note?: string | null;
}) {
  return (
    <div className="mcap-m-field">
      <div className="mcap-m-field-line">
        <span className="mcap-m-label">{label}</span>
        <span className="mcap-m-value">{children}</span>
      </div>
      {note && <p className="mcap-m-note">{note}</p>}
    </div>
  );
}

export default function MarketCapMobileList({ rows }: { rows: MarketCapRow[] }) {
  const [openTicker, setOpenTicker] = useState<string | null>(null);

  function toggle(ticker: string) {
    const next = openTicker === ticker ? null : ticker;
    setOpenTicker(next);
    // À l'OUVERTURE seulement — mesurer aussi les fermetures gonflerait le
    // chiffre d'environ ×2 sans qu'on puisse le détecter après coup.
    if (next) trackEvent('depli-ligne-mobile', { ticker });
  }

  return (
    <div className="mcap-m">
      {/* En-tête de colonnes + affordance : un chevron seul n'annonce pas
          qu'il y a quelque chose à déplier. */}
      <div className="mcap-m-head" aria-hidden="true">
        <span>{t.secteur.colonnes.societe}</span>
        <span className="right">{t.secteur.colonnes.capitalisation}</span>
        <span className="right">{t.secteur.colonnes.jour}</span>
      </div>
      <p className="mcap-m-hint">{t.secteur.mobile.hint}</p>

      <ul className="mcap-m-list">
        {rows.map(row => {
          const open = openTicker === row.ticker;
          const panelId = `mcap-m-panel-${row.ticker}`;
          const note = TICKER_NOTES[row.ticker];
          const modality = TICKER_MODALITIES[row.ticker];
          const ps = psPresentation(row);
          const freshness = sharesFreshness(row);
          const mcap = marketCapPresentation(row);

          return (
            <li key={row.ticker} className="mcap-m-item">
              <button
                type="button"
                className="mcap-m-row"
                aria-expanded={open}
                aria-controls={panelId}
                aria-label={`${t.secteur.mobile.detailAriaPrefix} ${row.name}`}
                onClick={() => toggle(row.ticker)}
                onKeyDown={e => {
                  if (e.key === 'Escape' && open) toggle(row.ticker);
                }}
              >
                <span className={`mcap-m-chevron${open ? ' is-open' : ''}`} aria-hidden="true">▸</span>

                <span className="mcap-m-society">
                  <span className="mcap-m-name">
                    {row.name}
                    {note && <sup className="mcap-fn-marker">{note.marker}</sup>}
                  </span>
                  <span className="mcap-m-sub">
                    <span className="mcap-m-ticker mono">{row.ticker}</span>
                    {modality && <span className="tech-tag">{modality}</span>}
                  </span>
                </span>

                <span className="mcap-m-cap mono">
                  {/* La fraîcheur douteuse se voit AVANT le dépliage — signaler
                      sans masquer ; l'explication suit dans le panneau. Même
                      règle pour la capitalisation absente : son marqueur est sur
                      la ligne repliée, son explication dans le panneau. */}
                  {freshness.stale && <span className="mcap-stale-icon" aria-hidden="true">⚠ </span>}
                  {mcap.text}
                  {mcap.marker && (
                    <span className="mcap-ps-marker" aria-hidden="true">{mcap.marker}</span>
                  )}
                </span>

                <span className="mcap-m-day">
                  <ChangeValue value={row.change_1d} />
                </span>
              </button>

              <div id={panelId} className="mcap-m-panel" hidden={!open}>
                <PanelRow label={t.secteur.colonnes.cours}>
                  <span className="mono">${row.adj_close.toFixed(2)}</span>
                </PanelRow>

                <PanelRow label={t.secteur.colonnes.ps} note={ps.note}>
                  <span
                    className={`mono mcap-ps${
                      ps.markerKind === 'uncertain'
                        ? ' mcap-ps-uncertain'
                        : ps.markerKind === 'insignificant'
                          ? ' mcap-ps-ns'
                          : ''
                    }`}
                  >
                    {ps.text}
                    {ps.marker && (
                      <span
                        className={
                          ps.markerKind === 'extreme' ? 'mcap-ps-extreme' : 'mcap-ps-marker'
                        }
                      >
                        {ps.marker}
                      </span>
                    )}
                  </span>
                </PanelRow>

                <PanelRow
                  label={t.secteur.colonnes.semaine}
                  note={row.change_1w_extreme ? t.secteur.variationExceptionnelle : null}
                >
                  <ChangeValue value={row.change_1w} alert={row.change_1w_extreme} />
                </PanelRow>

                <PanelRow label={t.secteur.colonnes.mois}>
                  <ChangeValue value={row.change_1m} />
                </PanelRow>

                {/* Date, source et éventuelle ancienneté sur UNE ligne : la note
                    de fraîcheur répétait la date déjà écrite juste au-dessus. */}
                <PanelRow label={t.secteur.mobile.actions}>
                  <span className="mono">
                    {row.shares != null ? formatShares(row.shares) : '—'}
                  </span>
                </PanelRow>
                {row.shares != null && row.shares_date != null ? (
                  <p className="mcap-m-note mcap-m-source">
                    {t.secteur.colonnes.actionsAu} {formatDateCompact(row.shares_date)} ·{' '}
                    {t.secteur.mobile.actionsSourcePrefix} {row.shares_source}
                    {freshness.stale && <> · {t.secteur.actionsTooltipStale}</>}
                  </p>
                ) : (
                  /* AUCUNE infobulle sur mobile (règle dure D4) : ce qui est un
                     `title=` sur desktop devient ici un texte visible. */
                  <p className="mcap-m-note mcap-m-source">{t.secteur.capiIndisponible.note}</p>
                )}

                <a
                  href={`/societe/${row.ticker.toLowerCase()}`}
                  className="mcap-m-fiche"
                  data-umami-event="clic-fiche-societe"
                  data-umami-event-ticker={row.ticker}
                >
                  {t.secteur.mobile.voirFiche}
                </a>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
