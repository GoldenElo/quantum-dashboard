import { t } from '@/i18n/t';
import { PDF_GRILLE_URL } from '@/lib/site';

// Bouton de téléchargement de la grille en PDF — partagé par /grille-etf et
// /etf-quantiques pour que le libellé et l'événement de mesure restent
// strictement identiques d'une page à l'autre (comparabilité des conversions).
// `download` force l'enregistrement plutôt que l'ouverture dans le lecteur.
export default function PdfDownloadButton({ hint = true }: { hint?: boolean }) {
  return (
    <div className="pdf-cta">
      <a
        href={PDF_GRILLE_URL}
        download
        className="pdf-btn"
        data-umami-event="clic-pdf-grille"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
        {t.grille.pdfLabel}
      </a>
      {hint && <span className="pdf-hint">{t.grille.pdfHint}</span>}
    </div>
  );
}
