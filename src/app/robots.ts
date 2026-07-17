import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site';

// /connexion et le portefeuille personnel ne sont pas des cibles d'indexation.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/connexion', '/portefeuille/personnel'],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
