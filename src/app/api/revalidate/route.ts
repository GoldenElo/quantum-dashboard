import { revalidatePath } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';

// Revalidation on-demand — purge le cache ISR/durable d'une ou plusieurs pages
// sans redéploiement. Appelée par les scripts d'édition manuelle (seed_events.py)
// après une écriture en base, pour que le contenu apparaisse immédiatement.
//
// Sécurité : protégée par un secret partagé (REVALIDATE_SECRET). Sans ce secret
// configuré côté serveur, la route refuse toute requête (fail-closed).
//
// Usage :
//   POST /api/revalidate?secret=XXX                → revalide toutes les fiches sociétés + l'accueil
//   POST /api/revalidate?secret=XXX&path=/societe/hq → revalide un chemin précis

export const dynamic = 'force-dynamic';

function authorized(req: NextRequest): boolean {
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret) return false; // fail-closed : pas de secret configuré ⇒ tout est refusé
  return req.nextUrl.searchParams.get('secret') === secret;
}

function handle(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const path = req.nextUrl.searchParams.get('path');
  if (path) {
    revalidatePath(path);
    return NextResponse.json({ ok: true, revalidated: [path] });
  }

  // Par défaut : les fiches sociétés (toute la route dynamique) + l'accueil + l'indice.
  // 'page' cible le segment de route, donc les 13 fiches d'un coup.
  const paths = ['/societe/[ticker]', '/', '/indice'];
  revalidatePath('/societe/[ticker]', 'page');
  revalidatePath('/');
  revalidatePath('/indice');

  // Les images OG (C4) sont des entrées de cache DISTINCTES de leurs pages : purger
  // /indice ne rafraîchit pas /indice/opengraph-image. Sans ces trois lignes, une
  // correction de donnée apparaîtrait sur le site mais la carte partagée sur X
  // continuerait d'afficher l'ancien chiffre jusqu'à 24 h — l'écart le plus visible
  // possible, puisque la carte circule hors du site.
  const ogPaths = ['/opengraph-image', '/indice/opengraph-image', '/societe/[ticker]/opengraph-image'];
  revalidatePath('/opengraph-image');
  revalidatePath('/indice/opengraph-image');
  revalidatePath('/societe/[ticker]/opengraph-image', 'page');

  return NextResponse.json({ ok: true, revalidated: [...paths, ...ogPaths] });
}

export const POST = handle;
export const GET = handle;
