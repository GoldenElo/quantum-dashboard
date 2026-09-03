import type { Metadata } from 'next';
import { fetchSectorTimeline } from '@/lib/api';
import { t } from '@/i18n/t';
import { SITE_URL } from '@/lib/site';
import EventTimeline from '@/components/EventTimeline';

export const revalidate = 86400;

/**
 * /secteur — la chronologie annotée du quantique coté (C6).
 *
 * C'est le SEUL rendu des événements GLOBAUX (`ticker is null`) : une fiche
 * société ne peut pas en afficher un, elle filtre sur son propre ticker. Un
 * texte réglementaire qui ne vise aucune société cotée n'avait donc, jusqu'ici,
 * nulle part où exister — c'est la raison d'être de cette page.
 *
 * Portée volontairement limitée à la chronologie. Le classement et les agrégats
 * sectoriels (S4, table `asset_meta`) viendront s'ajouter ICI, sur la même route,
 * quand ils seront écrits : on ne préconstruit pas leurs sections vides.
 */
export async function generateMetadata(): Promise<Metadata> {
  const events = await fetchSectorTimeline();
  const description =
    `${events.length} événements datés et sourcés du secteur quantique coté : introductions ` +
    `en bourse, fusions SPAC, dilutions, contrats, gouvernance et textes réglementaires. ` +
    `Chronologie éditoriale de The Quantum Wall, à titre informatif.`;

  return {
    title: { absolute: t.pageSecteur.metaTitle },
    description,
    alternates: { canonical: '/secteur' },
    openGraph: {
      title: t.pageSecteur.metaTitle,
      description,
      url: `${SITE_URL}/secteur`,
      type: 'website',
    },
  };
}

export default async function SecteurPage() {
  const events = await fetchSectorTimeline();
  const compteur = events.length === 1
    ? t.pageSecteur.compteurUn
    : t.pageSecteur.compteur.replace('{n}', String(events.length));

  return (
    <main className="page" aria-label={t.pageSecteur.aria.page}>
      <a href="/" className="detail-back">{t.pageSecteur.retour}</a>

      <div className="detail-header">
        <h1 className="detail-title">{t.pageSecteur.titre}</h1>
        <p className="home-subtitle">{t.pageSecteur.soustitre}</p>
      </div>

      <section className="section" aria-label={t.pageSecteur.aria.frise}>
        <h2 className="section-title">{t.pageSecteur.friseTitre}</h2>
        {events.length === 0 ? (
          <p className="empty-state">{t.pageSecteur.vide}</p>
        ) : (
          <>
            <p className="chart-note secteur-compteur mono">{compteur}</p>
            {/* showScope : la frise mélange les sociétés, chaque ligne doit dire
                de qui elle parle — ou « Secteur » quand elle ne parle de personne. */}
            <EventTimeline events={events} ticker="GLOBAL" showScope />
          </>
        )}
        <p className="chart-note">{t.pageSecteur.note}</p>
      </section>

      {/* Slot publicitaire réservé — vide, hauteur 0, n'affecte pas le layout */}
      <div className="ad-slot ad-slot-bottom" aria-hidden="true" />

      <div className="disclaimer-banner" role="note">
        <strong>{t.pageSecteur.disclaimer}</strong>
      </div>
    </main>
  );
}
