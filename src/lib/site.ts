// Constantes de site partagées — centralisées pour être réutilisées par le layout
// (metadataBase), le sitemap et les fiches. L'ancien quantum-wall.netlify.app
// redirige en 301 vers le domaine officiel.
export const SITE_URL = 'https://thequantumwall.com';

// Chaîne éditrice — L'Investisseuse Quantique. Point de conversion du trafic froid
// (fiches sociétés) vers la chaîne : un actif d'audience au sens de la thèse de cession.
export const YOUTUBE_URL = 'https://www.youtube.com/@InvestisseuseQuantique';
export const X_URL = 'https://x.com/InvestQuantique';

// Vidéo « ETF quantiques : la méthode » — publiée le 2026-08-07.
// Cible des liens vidéo de /etf-quantiques (appel à signalement d'un fonds
// manquant) et /grille-etf. Les deux pages la consomment d'ici : une seule
// ligne à changer si la vidéo est remplacée ou re-uploadée.
export const VIDEO_ETF_URL = 'https://www.youtube.com/watch?v=j8so3Qube-I';

// Grille des 5 critères en PDF — servi statiquement depuis public/.
// Le fichier est un artefact éditorial versionné, pas un généré : il se remplace
// à la main quand la grille évolue (l'article docs/*.fr.md doit suivre).
export const PDF_GRILLE_URL = '/grille-5-criteres-etf.pdf';
