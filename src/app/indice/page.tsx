import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Metadata } from 'next';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { fetchIndexData } from '@/lib/api';
import { formatDate, formatPct } from '@/lib/format';
import { t } from '@/i18n/t';
import { SITE_URL } from '@/lib/site';
import IndexChart from '@/components/IndexChart';
import IndexConstituentsTable from '@/components/IndexConstituentsTable';

export const revalidate = 86400;

// Le document de méthodologie est la SOURCE UNIQUE : il vit dans docs/, versionné
// en git comme artefact publié, et il est rendu tel quel ici. Aucune duplication
// dans fr.ts → aucune dérive possible entre le document et la page.
// La version anglaise sera un .en.md entier : c'est du CONTENU, pas un libellé
// d'interface (tous les libellés autour passent par t.indice.*).
function readMethodology(): string | null {
  try {
    return readFileSync(join(process.cwd(), 'docs', 'methodologie-indice-tqw.fr.md'), 'utf8');
  } catch {
    // Jamais de page cassée pour un document illisible — on dégrade proprement.
    return null;
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const data = await fetchIndexData();

  const bits: string[] = [];
  if (data) {
    bits.push(`valeur ${data.value.toFixed(2).replace('.', ',')} (base 100 au ${formatDate(data.inception_date)})`);
    bits.push(`${formatPct(data.change_since_inception)} depuis l'inception`);
    bits.push(`${data.constituents.length} valeurs`);
  }
  const chiffres = bits.length > 0 ? ` ${bits.join(', ')}.` : '';

  const description =
    `L'Indice TQW mesure la performance des pure-players du quantique coté :${chiffres} ` +
    `Pondération par capitalisation, plafond de 25 % par valeur, rebalancement trimestriel, ` +
    `méthodologie publiée. Indice informatif et non investissable.`;

  return {
    title: { absolute: t.indice.metaTitle },
    description,
    alternates: { canonical: '/indice' },
    openGraph: {
      title: t.indice.metaTitle,
      description,
      url: `${SITE_URL}/indice`,
      type: 'website',
    },
  };
}

// Chiffre clé — variation colorée, « — » si non calculable.
function ChangeStat({ label, value }: { label: string; value: number | null }) {
  const sign = value == null ? '' : value >= 0 ? 'positive' : 'negative';
  return (
    <div className="stat-box">
      <span className="stat-label">{label}</span>
      <span className={`stat-value mono ${sign}`}>
        {value == null ? '—' : formatPct(value)}
      </span>
    </div>
  );
}

export default async function IndicePage() {
  const data = await fetchIndexData();
  const methodology = readMethodology();

  return (
    <main className="page" aria-label={t.indice.aria.page}>
      <a href="/" className="detail-back">{t.indice.retour}</a>

      <div className="detail-header">
        <h1 className="detail-title">{t.indice.nom}</h1>
        <p className="home-subtitle">{t.indice.soustitre}</p>
        {data && (
          <p className="company-timestamp">
            {t.indice.horodatagePrefix} {formatDate(data.latest_date)}{t.indice.horodatageSuffix}
          </p>
        )}
      </div>

      {!data ? (
        <p className="empty-state">{t.indice.indisponible}</p>
      ) : (
        <>
          <section aria-label={t.indice.aria.chiffres}>
            <div className="stats-grid">
              <div className="stat-box">
                <span className="stat-label">{t.indice.chiffres.valeur}</span>
                <span className="stat-value mono indice-hero-value">
                  {data.value.toFixed(2).replace('.', ',')}
                </span>
              </div>
              <ChangeStat label={t.indice.chiffres.jour} value={data.change_1d} />
              <ChangeStat label={t.indice.chiffres.semaine} value={data.change_1w} />
              <ChangeStat label={t.indice.chiffres.mois} value={data.change_1m} />
              <ChangeStat
                label={t.indice.chiffres.depuisInception}
                value={data.change_since_inception}
              />
              <div className="stat-box">
                <span className="stat-label">{t.indice.chiffres.constituants}</span>
                <span className="stat-value mono">{data.constituents.length}</span>
              </div>
            </div>
          </section>

          <section className="section" aria-label={t.indice.chart.titre}>
            <h2 className="section-title">{t.indice.chart.titre}</h2>
            <div className="chart-container">
              <IndexChart data={data.series} />
            </div>
            <p className="chart-note">{t.indice.chart.note}</p>
          </section>

          <IndexConstituentsTable
            constituents={data.constituents}
            lastRebalance={data.last_rebalance}
          />
        </>
      )}

      {/* Méthodologie publiée — rendue depuis docs/methodologie-indice-tqw.fr.md */}
      <section className="section" aria-label={t.indice.methodologie.titre}>
        <h2 className="section-title">{t.indice.methodologie.titre}</h2>
        <div className="chart-container">
          {methodology ? (
            <div className="indice-methodo">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{methodology}</ReactMarkdown>
            </div>
          ) : (
            <p className="empty-state">{t.indice.methodologie.indisponible}</p>
          )}
        </div>
      </section>

      {/* Slot publicitaire réservé — vide, hauteur 0, n'affecte pas le layout */}
      <div className="ad-slot ad-slot-bottom" aria-hidden="true" />

      <div className="disclaimer-banner" role="note">
        <strong>{t.indice.disclaimer}</strong>
      </div>
    </main>
  );
}
