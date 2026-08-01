import { formatPct } from '@/lib/format';
import { t } from '@/i18n/t';
import type { IndexSummary } from '@/lib/api';

type Props = { summary: IndexSummary };

// Bandeau compact d'accueil — entre le graphique comparatif et la HeatMap.
// L'indice sectoriel est délibérément SÉPARÉ de la grille des portefeuilles :
// ce sont deux objets de nature différente (IP propriétaire vs benchmarks
// pédagogiques), les mélanger dans le même bloc brouillerait le propos.
export default function IndexHomeBanner({ summary }: Props) {
  const daySign = summary.change_1d == null ? '' : summary.change_1d >= 0 ? 'positive' : 'negative';
  const inceptionSign = summary.change_since_inception >= 0 ? 'positive' : 'negative';

  return (
    <section className="section indice-banner" aria-label={t.indice.aria.carte}>
      <a
        href="/indice"
        className="indice-banner-link"
        aria-label={t.indice.carte.lienAria}
        data-umami-event="clic-indice"
      >
        <div className="indice-banner-head">
          <span className="indice-banner-title">{t.indice.carte.titre}</span>
          <span className="indice-banner-tagline">{t.indice.carte.accroche}</span>
        </div>

        <div className="indice-banner-figures">
          <span className="indice-banner-value mono">
            {summary.value.toFixed(2).replace('.', ',')}
          </span>
          <span className={`indice-banner-change mono ${daySign}`}>
            {summary.change_1d == null ? '—' : formatPct(summary.change_1d)}
          </span>
          <span className={`indice-banner-since mono ${inceptionSign}`}>
            {formatPct(summary.change_since_inception)}
            <span className="indice-banner-since-label">
              {' '}{t.indice.carte.depuisInception}
            </span>
          </span>
          <span className="indice-banner-count mono">
            {summary.constituents_count} {t.indice.carte.constituantsSuffixe}
          </span>
        </div>

        <span className="indice-banner-cta">{t.indice.carte.lien} →</span>
      </a>
    </section>
  );
}
