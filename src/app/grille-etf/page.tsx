import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Metadata } from 'next';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import PdfDownloadButton from '@/components/PdfDownloadButton';
import { t } from '@/i18n/t';
import { SITE_URL, VIDEO_ETF_URL } from '@/lib/site';

// Même doctrine que /indice : le texte de l'article vit dans docs/, versionné en
// git comme artefact publié, et il est rendu TEL QUEL. Aucune copie dans fr.ts
// → aucune dérive possible entre le document et la page. La version anglaise
// sera un .en.md entier : c'est du CONTENU, pas un libellé d'interface.
function readArticle(): string | null {
  try {
    return readFileSync(join(process.cwd(), 'docs', 'grille-5-criteres-etf.fr.md'), 'utf8');
  } catch {
    // Jamais de page cassée pour un document illisible — on dégrade proprement.
    return null;
  }
}

export const metadata: Metadata = {
  title: { absolute: t.grille.metaTitle },
  description: t.grille.metaDescription,
  alternates: { canonical: '/grille-etf' },
  openGraph: {
    title: t.grille.metaTitle,
    description: t.grille.metaDescription,
    url: `${SITE_URL}/grille-etf`,
    type: 'article',
  },
};

function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // diacritiques
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Ancres COURTES et stables, destinées aux liens profonds depuis la description
// YouTube (#accessibilite, #encours…). La table est explicite plutôt que dérivée
// du titre : elle survit à une reformulation du titre côté document, et un lien
// déjà publié ne casse pas. Clés = titre slugifié (insensible au type d'apostrophe).
const ANCRES: Record<string, string> = {
  '1-l-accessibilite': 'accessibilite',
  '2-l-encours': 'encours',
  '3-les-frais': 'frais',
  '4-la-composition': 'composition',
  '5-l-indice-suivi': 'indice-suivi',
  'ce-que-la-grille-conclut-sur-l-offre-actuelle': 'conclusion',
};

type TextLike = { value?: string; children?: TextLike[] };

function nodeText(node: TextLike | undefined): string {
  if (!node) return '';
  if (typeof node.value === 'string') return node.value;
  return (node.children ?? []).map(nodeText).join('');
}

const components: Components = {
  h2({ node, children }) {
    // `node` est un nœud hast ; seul son texte nous intéresse pour l'ancre.
    const text = nodeText(node as unknown as TextLike);
    const slug = slugify(text);
    return <h2 id={ANCRES[slug] ?? slug}>{children}</h2>;
  },
};

export default function GrilleEtfPage() {
  const article = readArticle();

  return (
    <main className="page" aria-label={t.grille.aria.page}>
      <a href="/" className="detail-back">{t.grille.retour}</a>

      {/* Téléchargement en tête d'article — la grille sert au moment de comparer,
          pas seulement à la lecture. */}
      <PdfDownloadButton />

      {article ? (
        <article className="article-body" aria-label={t.grille.aria.article}>
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
            {article}
          </ReactMarkdown>
        </article>
      ) : (
        <p className="empty-state">{t.grille.indisponible}</p>
      )}

      <PdfDownloadButton hint={false} />

      {/* Lien croisé vers le tableau comparatif */}
      <section className="section" aria-label={t.grille.versTableauTitre}>
        <div className="chart-container etf-crosslink">
          <h2 className="section-title">{t.grille.versTableauTitre}</h2>
          <p className="etf-crosslink-text">{t.grille.versTableauTexte}</p>
          <a
            href="/etf-quantiques"
            className="etf-crosslink-link"
            data-umami-event="clic-etf"
            data-umami-event-source="grille-etf"
          >
            {t.grille.versTableauLien}
          </a>
          <p className="etf-crosslink-video">
            <a
              href={VIDEO_ETF_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={t.etf.aria.videoLien}
              data-umami-event="clic-video-etf"
              data-umami-event-page="grille-etf"
            >
              {t.grille.videoLien}
            </a>
          </p>
        </div>
      </section>

      {/* Slot publicitaire réservé — vide, hauteur 0, n'affecte pas le layout */}
      <div className="ad-slot ad-slot-bottom" aria-hidden="true" />

      {/* Pas de bandeau de disclaimer ici : le document source porte déjà sa
          mention et sa signature — le dupliquer dirait deux fois la même chose. */}
    </main>
  );
}
