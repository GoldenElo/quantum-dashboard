import { fetchMarketCapsData } from '@/lib/api';
import SectorTreemap from '@/components/SectorTreemap';
import { t } from '@/i18n/t';

export const revalidate = 86400;

export const metadata = {
  title: 'Le Mur — The Quantum Wall',
  description:
    'Treemap des capitalisations du secteur quantique. Performances passées à titre informatif — ni conseil ni recommandation.',
};

export default async function MurPage() {
  const marketCapData = await fetchMarketCapsData();

  return (
    <main className="page">
      {/* Slot publicitaire réservé (vide) */}
      <div className="ad-slot ad-slot-top" aria-hidden="true" />

      <header className="home-header">
        <h1 className="home-title">{t.mur.titre}</h1>
        <p className="home-subtitle">{t.mur.soustitre}</p>
        {/* Disclaimer éditorial non négociable — jamais un signal d'achat/vente */}
        <p className="mur-disclaimer-edito">{t.mur.disclaimerEditorial}</p>
      </header>

      <section className="section" aria-label={t.mur.aria.region}>
        {marketCapData
          ? <SectorTreemap rows={marketCapData.rows} />
          : <div className="chart-placeholder mur-placeholder" />}
        <p className="chart-note">{t.mur.disclaimerDonnees}</p>
      </section>

      {/* Slot publicitaire réservé (vide) */}
      <div className="ad-slot ad-slot-bottom" aria-hidden="true" />
    </main>
  );
}
