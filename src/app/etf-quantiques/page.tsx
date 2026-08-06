import type { Metadata } from 'next';
import EtfTable from '@/components/EtfTable';
import PdfDownloadButton from '@/components/PdfDownloadButton';
import { ETF_HORS_COREE, ETF_COREE } from '@/data/etf-quantiques';
import { t } from '@/i18n/t';
import { SITE_URL, VIDEO_ETF_URL } from '@/lib/site';

// Page statique : les données sont éditoriales (fichier versionné), pas en base.
// Rien à revalider — elle change au déploiement, comme le contenu qui la porte.
export const metadata: Metadata = {
  title: { absolute: t.etf.metaTitle },
  description: t.etf.metaDescription,
  alternates: { canonical: '/etf-quantiques' },
  openGraph: {
    title: t.etf.metaTitle,
    description: t.etf.metaDescription,
    url: `${SITE_URL}/etf-quantiques`,
    type: 'article',
  },
};

export default function EtfQuantiquesPage() {
  return (
    <main className="page" aria-label={t.etf.aria.page}>
      <a href="/" className="detail-back">{t.etf.retour}</a>

      <div className="detail-header">
        <h1 className="detail-title">{t.etf.titre}</h1>
        <p className="home-subtitle">{t.etf.soustitre}</p>
      </div>

      {/* Slot publicitaire réservé — vide, hauteur 0, n'affecte pas le layout */}
      <div className="ad-slot ad-slot-top" aria-hidden="true" />

      <section className="section" aria-label={t.etf.aria.tableau}>
        <div className="chart-container" style={{ padding: 0 }}>
          <EtfTable items={ETF_HORS_COREE} ariaLabel={t.etf.aria.tableau} />

          {/* Corée : repliée par défaut — aucun de ces fonds n'est accessible
              depuis l'Europe. <details> natif : zéro JavaScript. */}
          <details className="etf-coree">
            <summary className="etf-coree-summary">{t.etf.coreeSummary}</summary>
            <EtfTable items={ETF_COREE} ariaLabel={t.etf.aria.tableauCoree} />
            <p className="etf-note">{t.etf.coreeNote}</p>
          </details>

          <p className="etf-note">
            <span className="etf-focus-marker">{t.etf.sujetVideoMarker}</span> {t.etf.sujetVideoNote}
          </p>
          <p className="etf-note">{t.etf.devisesNote}</p>
        </div>
      </section>

      <section className="section" aria-label={t.etf.notesTitre}>
        <h2 className="section-title">{t.etf.notesTitre}</h2>
        <div className="chart-container">
          <ul className="etf-lecture">
            {t.etf.notes.map((note, i) => (
              <li key={i}>{note}</li>
            ))}
          </ul>
        </div>
      </section>

      {/* Lien croisé vers l'article de méthode + téléchargement du PDF */}
      <section className="section" aria-label={t.etf.versArticleTitre}>
        <div className="chart-container etf-crosslink">
          <h2 className="section-title">{t.etf.versArticleTitre}</h2>
          <p className="etf-crosslink-text">{t.etf.versArticleTexte}</p>
          <a href="/grille-etf" className="etf-crosslink-link">{t.etf.versArticleLien}</a>
          <PdfDownloadButton />
        </div>
      </section>

      {/* Appel à signalement — la vérification reste faite sur source primaire */}
      <section className="section" aria-label={t.etf.signalementTitre}>
        <div className="chart-container etf-signalement">
          <h2 className="section-title">{t.etf.signalementTitre}</h2>
          <p className="etf-crosslink-text">{t.etf.signalementTexte}</p>
          <a
            href={VIDEO_ETF_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="etf-crosslink-link"
            aria-label={t.etf.aria.videoLien}
            data-umami-event="clic-video-etf"
            data-umami-event-page="etf-quantiques"
          >
            {t.etf.signalementLien}
          </a>
        </div>
      </section>

      {/* Slot publicitaire réservé — vide, hauteur 0, n'affecte pas le layout */}
      <div className="ad-slot ad-slot-bottom" aria-hidden="true" />

      <div className="disclaimer-banner" role="note">
        <strong>{t.etf.disclaimer}</strong>
      </div>
    </main>
  );
}
