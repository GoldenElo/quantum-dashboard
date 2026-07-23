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

  // Par défaut : les fiches sociétés (toute la route dynamique) + l'accueil.
  // 'page' cible le segment de route, donc les 13 fiches d'un coup.
  revalidatePath('/societe/[ticker]', 'page');
  revalidatePath('/');
  return NextResponse.json({ ok: true, revalidated: ['/societe/[ticker]', '/'] });
}

export const POST = handle;
export const GET = handle;
