// Constantes de site partagées — centralisées pour être réutilisées par le layout
// (metadataBase), le sitemap et les fiches. L'ancien quantum-wall.netlify.app
// redirige en 301 vers le domaine officiel.
export const SITE_URL = 'https://thequantumwall.com';

// Chaîne éditrice — L'Investisseuse Quantique. Point de conversion du trafic froid
// (fiches sociétés) vers la chaîne : un actif d'audience au sens de la thèse de cession.
export const YOUTUBE_URL = 'https://www.youtube.com/@InvestisseuseQuantique';
export const X_URL = 'https://x.com/InvestQuantique';

// ⚠ PLACEHOLDER — vidéo « ETF quantiques : la méthode ».
// La vidéo n'est pas encore publiée : ce lien pointe pour l'instant sur la chaîne.
// UNE SEULE LIGNE À REMPLACER le jour de la publication (URL de la vidéo) — les
// pages /etf-quantiques et /grille-etf la consomment toutes les deux d'ici.
export const VIDEO_ETF_URL = YOUTUBE_URL;

// Grille des 5 critères en PDF — servi statiquement depuis public/.
// Le fichier est un artefact éditorial versionné, pas un généré : il se remplace
// à la main quand la grille évolue (l'article docs/*.fr.md doit suivre).
export const PDF_GRILLE_URL = '/grille-5-criteres-etf.pdf';
