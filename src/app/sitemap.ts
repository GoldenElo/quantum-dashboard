import type { MetadataRoute } from 'next';
import { listCompanyTickers, fetchLatestCloseDate } from '@/lib/api';
import { SITE_URL } from '@/lib/site';

export const revalidate = 86400;

// Accueil + 12 fiches sociétés + 3 portefeuilles fictifs (pages publiques SEO).
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

  return [home, ...companies, ...portfolios];
}
