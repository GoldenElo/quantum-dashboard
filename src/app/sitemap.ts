import type { MetadataRoute } from 'next';
import { listCompanyTickers, fetchLatestCloseDate } from '@/lib/api';
import { SITE_URL } from '@/lib/site';

export const revalidate = 86400;

// Accueil + /indice + /secteur + pages ETF + 14 fiches sociétés + 3 portefeuilles fictifs (SEO).
// /portefeuille/personnel volontairement exclu (données perso, pas une cible SEO).
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const latest = await fetchLatestCloseDate();
  const lastModified = latest ? new Date(latest) : undefined;

  const home: MetadataRoute.Sitemap[number] = {
    url: SITE_URL,
    lastModified,
    changeFrequency: 'daily',
    priority: 1,
  };

  // Indice TQW — IP propriétaire, priorité juste sous l'accueil.
  const indice: MetadataRoute.Sitemap[number] = {
    url: `${SITE_URL}/indice`,
    lastModified,
    changeFrequency: 'daily',
    priority: 0.9,
  };

  // Chronologie sectorielle (C6) — moat par accumulation : elle s'enrichit au fil
  // de la veille, d'où une fréquence quotidienne alors que son contenu est éditorial.
  const secteur: MetadataRoute.Sitemap[number] = {
    url: `${SITE_URL}/secteur`,
    lastModified,
    changeFrequency: 'daily',
    priority: 0.9,
  };

  // Pages éditoriales ETF — contenu statique (fichier de données + document
  // markdown versionnés) : lastModified ne suit pas les clôtures de marché.
  const editorial: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/etf-quantiques`, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${SITE_URL}/grille-etf`, changeFrequency: 'monthly', priority: 0.8 },
  ];

  const companies: MetadataRoute.Sitemap = listCompanyTickers().map(ticker => ({
    url: `${SITE_URL}/societe/${ticker.toLowerCase()}`,
    lastModified,
    changeFrequency: 'daily',
    priority: 0.8,
  }));

  const portfolios: MetadataRoute.Sitemap = ['defensif', 'dynamique', 'agressif'].map(id => ({
    url: `${SITE_URL}/portefeuille/${id}`,
    lastModified,
    changeFrequency: 'daily',
    priority: 0.7,
  }));

  return [home, indice, secteur, ...editorial, ...companies, ...portfolios];
}
