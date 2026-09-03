import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { fetchCompanyData, listCompanyTickers, type CompanyData } from '@/lib/api';
import { formatMarketCap, formatPct, formatDate, formatDateCompact, formatRatio } from '@/lib/format';
import { t, TICKER_NOTES, TICKER_MODALITIES, TICKER_VIDEO_URL, VIDEO_PLAYLIST_URL } from '@/i18n/t';
import { SITE_URL } from '@/lib/site';
import { isStale } from '@/lib/dilution';
import CompanyCapChart from '@/components/CompanyCapChart';
import EventTimeline from '@/components/EventTimeline';
import DilutionSection from '@/components/DilutionSection';

export const revalidate = 86400;
// Seules les 12 fiches existent — tout autre ticker renvoie un 404 propre.
export const dynamicParams = false;

// isStale vit désormais dans src/lib/dilution.ts — SOURCE UNIQUE du seuil de
// 150 j. Cette page et le tableau des caps en portaient chacun une copie ; une
// troisième pour les liquidités (C7) aurait garanti la divergence.

// Notes éditoriales applicables à un ticker (curation différenciante).
// TICKER_NOTES (Up-C QNT, quantum washing ARQQ) + note HQ propre au Mur.
function editorialNotes(ticker: string): { marker: string; text: string }[] {
  const notes: { marker: string; text: string }[] = [];
  if (TICKER_NOTES[ticker]) notes.push(TICKER_NOTES[ticker]);
  if (ticker === 'HQ') notes.push(t.mur.hqNote);
  return notes;
}

export function generateStaticParams() {
  return listCompanyTickers().map(ticker => ({ ticker: ticker.toLowerCase() }));
}

type Props = { params: Promise<{ ticker: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { ticker } = await params;
  const data = await fetchCompanyData(ticker);
  if (!data) return {};

  const title = `${data.name} (${data.ticker}) ${t.societe.metaTitleSuffix}`;
  // Description factuelle par société, mentionnant les chiffres clés.
  const bits: string[] = [];
  if (data.market_cap_usd != null) bits.push(`capitalisation ${formatMarketCap(data.market_cap_usd)}`);
  if (data.ps_status === 'firm' || data.ps_status === 'firm_extreme') bits.push(`P/S ${formatRatio(data.ps_ratio)}`);
  if (data.change_1w != null) bits.push(`variation semaine ${formatPct(data.change_1w)}`);
  const chiffres = bits.length > 0 ? ` ${bits.join(', ')}.` : '';
  const description =
    `${data.name} (${data.ticker}) en bourse :${chiffres} ` +
    `Suivi des capitalisations, valorisation et variations du secteur quantique coté sur The Quantum Wall. ` +
    `Données de clôture à J‑1, à titre informatif.`;

  const canonical = `/societe/${data.ticker.toLowerCase()}`;
  return {
    title: { absolute: title },
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: `${SITE_URL}${canonical}`,
      type: 'website',
    },
  };
}

// Cellule de variation — verte/rouge foncé, « — » si null, ⚑ si exceptionnelle.
function ChangeStat({ label, value, alert = false }: { label: string; value: number | null; alert?: boolean }) {
  const sign = value == null ? '' : value >= 0 ? 'positive' : 'negative';
  return (
    <div className="stat-box">
      <span className="stat-label">{label}</span>
      <span className={`stat-value mono ${sign}`}>
        {value == null ? '—' : formatPct(value)}
        {alert && value != null && (
          <span className="mcap-alert" title={t.secteur.variationExceptionnelle}> ⚑</span>
        )}
      </span>
    </div>
  );
}

// P/S — réutilise le vocabulaire à deux niveaux du tableau (ferme / ⚠ / ‡ / n.s.).
function psDisplay(data: CompanyData): { text: string; marker?: string; tooltip?: string } {
  switch (data.ps_status) {
    case 'none': return { text: '—' };
    case 'insignificant': return { text: t.secteur.ps.insignifiant, tooltip: t.secteur.ps.insignifiantTooltip };
    case 'firm': return { text: formatRatio(data.ps_ratio) };
    case 'firm_extreme': return { text: formatRatio(data.ps_ratio), marker: t.secteur.ps.extremeMarker, tooltip: t.secteur.ps.extremeTooltip };
    case 'partial': return { text: formatRatio(data.ps_ratio), marker: t.secteur.ps.incertainMarker, tooltip: t.secteur.ps.partielTooltip };
    case 'unrecouped': return { text: formatRatio(data.ps_ratio), marker: t.secteur.ps.incertainMarker, tooltip: t.secteur.ps.nonRecoupeTooltip };
  }
}

export default async function CompanyPage({ params }: Props) {
  const { ticker } = await params;
  const data = await fetchCompanyData(ticker);
  if (!data) notFound();

  const categoryLabel = t.societe.categories[data.category] ?? data.category;
  const modality = TICKER_MODALITIES[data.ticker];
  const notes = editorialNotes(data.ticker);
  const ps = psDisplay(data);
  const stale = isStale(data.shares_date);
  // La section Dilution garde l'habillage « placeholder » tant qu'elle n'a rien
  // à montrer — miroir de la condition de repli du composant.
  const hasDilution =
    data.sharesHistory.length > 0 || data.financials != null || data.filings.length > 0
    || data.warrants.length > 0;
  // Première séance de cotation — repère de valorisation d'une ex-SPAC. Les cours
  // du jour ne vivent pas dans price_daily (qui ne porte que la clôture) : c'est
  // une donnée éditoriale sourcée, pas une série de marché.
  const firstDay = data.referencePrices.find(r => r.kind === 'first_trading_day') ?? null;
  // IPO récente : historique présent mais pas d'offset annuel calculable.
  const depuisCotation = data.hasHistory && data.change_1y == null;
  // Ligne d'acquisition : vidéo dédiée à la société, ou playlist générale à défaut.
  const videoUrl = TICKER_VIDEO_URL[data.ticker] ?? VIDEO_PLAYLIST_URL;
  const acquisitionLabel = videoUrl === VIDEO_PLAYLIST_URL
    ? t.societe.acquisitionPlaylist
    : t.societe.acquisitionDediee.replace('{societe}', data.name);

  return (
    <main className="page" aria-label={`${t.societe.ficheAria} ${data.name}`}>
      <a href="/" className="detail-back">{t.societe.retour}</a>

      <div className="detail-header company-header">
        <div className="company-title-row">
          <h1 className="detail-title">{data.name}</h1>
          <span className="company-ticker mono">{data.ticker}</span>
        </div>
        <div className="company-badges">
          <span className="company-cat-badge">{categoryLabel}</span>
          {modality && <span className="tech-tag">{modality}</span>}
        </div>
        {data.price_date && (
          <p className="company-timestamp">
            {t.societe.horodatagePrefix} {formatDate(data.price_date)}{t.societe.horodatageSuffix}
          </p>
        )}
      </div>

      {/* Chiffres actuels */}
      <section aria-label="Indicateurs clés">
        <div className="stats-grid">
          <div className="stat-box">
            <span className="stat-label">{t.societe.chiffres.cours}</span>
            <span className="stat-value mono">{data.adj_close != null ? `$${data.adj_close.toFixed(2)}` : '—'}</span>
          </div>
          <div className="stat-box">
            <span className="stat-label">{t.societe.chiffres.capitalisation}</span>
            <span className="stat-value mono">{data.market_cap_usd != null ? formatMarketCap(data.market_cap_usd) : '—'}</span>
          </div>
          <div className="stat-box">
            <span className="stat-label">{t.societe.chiffres.ps}</span>
            <span className="stat-value mono" title={ps.tooltip}>
              {ps.text}{ps.marker && <span className="company-ps-marker"> {ps.marker}</span>}
            </span>
          </div>
          <ChangeStat label={t.societe.chiffres.jour} value={data.change_1d} />
          <ChangeStat label={t.societe.chiffres.semaine} value={data.change_1w} alert={data.change_1w_extreme} />
          <ChangeStat label={t.societe.chiffres.mois} value={data.change_1m} />
          <div className="stat-box company-shares-box">
            <span className="stat-label">{t.societe.chiffres.actions}</span>
            <span className="stat-value mono">
              {data.shares != null ? new Intl.NumberFormat('fr-FR').format(data.shares) : '—'}
            </span>
            {data.shares_date && (
              <span className="stat-label company-shares-meta">
                {t.societe.actionsAuPrefix} {formatDateCompact(data.shares_date)}
                {stale && ` ${t.societe.actionsStale}`}
                {data.shares_source && ` · ${t.societe.actionsSourcePrefix} ${data.shares_source}`}
              </span>
            )}
            {depuisCotation && (
              <span className="stat-label company-shares-meta">{t.societe.depuisCotation}</span>
            )}
          </div>
        </div>
      </section>

      {/* Courbe de capitalisation + note de méthode */}
      <section className="section" aria-label={t.societe.capChart.titre}>
        <h2 className="section-title">{t.societe.capChart.titre}</h2>
        <div className="chart-container">
          {data.shares == null
            ? <p className="empty-state">{t.societe.capChart.sansActions}</p>
            : <CompanyCapChart data={data.capHistory} />}
        </div>
        {/* La note de méthode décrit une RECONSTITUTION : ne l'afficher que si
            une courbe a effectivement été reconstituée. Sous une section vide,
            elle décrirait un calcul qui n'a pas eu lieu. */}
        {data.shares != null && data.capHistory.length >= 2 && (
          <p className="chart-note">{t.societe.capChart.methode}</p>
        )}
      </section>

      {/* Première séance de cotation — placée juste après la capitalisation :
          c'est là que la question « à partir de quel prix ? » se pose. Le prix
          d'OPÉRATION est affiché à côté des cours, parce que c'est contre lui,
          jamais contre le cours, que se contrôle une valorisation post-fusion. */}
      {firstDay && (
        <section className="section" aria-label={t.societe.dilution.referenceTitre}>
          <h2 className="section-title">{t.societe.dilution.referenceTitre}</h2>
          <div className="dil-metrics">
            {firstDay.open_usd != null && (
              <div className="dil-metric">
                <span className="stat-label">{t.societe.dilution.referenceOuverture}</span>
                <span className="stat-value mono">{`$${firstDay.open_usd.toFixed(2)}`}</span>
              </div>
            )}
            {firstDay.high_usd != null && (
              <div className="dil-metric">
                <span className="stat-label">{t.societe.dilution.referencePlusHaut}</span>
                <span className="stat-value mono">{`$${firstDay.high_usd.toFixed(2)}`}</span>
              </div>
            )}
            {firstDay.close_usd != null && (
              <div className="dil-metric">
                <span className="stat-label">{t.societe.dilution.referenceCloture}</span>
                <span className="stat-value mono">{`$${firstDay.close_usd.toFixed(2)}`}</span>
              </div>
            )}
            {firstDay.reference_usd != null && (
              <div className="dil-metric">
                <span className="stat-label">{t.societe.dilution.referenceOperation}</span>
                <span className="stat-value mono">{`$${firstDay.reference_usd.toFixed(2)}`}</span>
              </div>
            )}
          </div>
          <p className="dil-meta">
            {t.societe.dilution.referenceLe.replace('{date}', formatDateCompact(firstDay.price_date))}
          </p>
          {firstDay.reference_note && (
            <p className="dil-meta">{firstDay.reference_note}</p>
          )}
          <p className="dil-meta dil-source">
            <a href={firstDay.source_url} target="_blank" rel="noopener noreferrer">
              {t.societe.dilution.referenceSource
                .replace('{form}', firstDay.source_form)
                .replace('{date}', formatDateCompact(firstDay.source_filed))}
            </a>
          </p>
        </section>
      )}

      {/* Notes de la rédaction — curation différenciante, mise en avant */}
      {notes.length > 0 && (
        <section className="section" aria-label={t.societe.notesTitre}>
          <h2 className="section-title">{t.societe.notesTitre}</h2>
          <div className="company-notes">
            {notes.map((n, i) => (
              <p key={i} className="company-note">
                <span className="company-note-marker">{n.marker}</span> {n.text}
              </p>
            ))}
          </div>
        </section>
      )}

      {/* Événements (C6) — frise si le ticker en a, sinon placeholder "Bientôt" */}
      <section
        className={`section${data.events.length === 0 ? ' company-placeholder' : ''}`}
        aria-label={t.evenements.titre}
      >
        <h2 className="section-title">{t.evenements.titre}</h2>
        {data.events.length > 0
          ? <EventTimeline events={data.events} ticker={data.ticker} />
          : <p className="company-soon">{t.evenements.bientot}</p>}
      </section>

      {/* Dilution (C7) — historique des actions ajusté, liquidités datées,
          dépôts déclarés. Le composant retombe seul sur le placeholder « bientôt »
          quand EDGAR ne donne rien d'exploitable pour la société. */}
      <section className={`section${hasDilution ? '' : ' company-placeholder'}`} aria-label={t.societe.dilution.titre}>
        <h2 className="section-title">{t.societe.dilution.titre}</h2>
        <DilutionSection data={data} />
      </section>

      {/* Ligne d'acquisition vers la chaîne — conversion du trafic froid.
          Cible la vidéo dédiée à la société (ou la playlist générale à défaut). */}
      <p className="company-acquisition">
        <a
          href={videoUrl}
          target="_blank"
          rel="noopener noreferrer"
          data-umami-event="clic-youtube-fiche"
          data-umami-event-ticker={data.ticker}
        >
          {acquisitionLabel} →
        </a>
      </p>

      <div className="disclaimer-banner" role="note">
        <strong>{t.societe.disclaimer}</strong>
      </div>
    </main>
  );
}
