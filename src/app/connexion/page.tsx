import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Connexion — L'Investisseuse Quantique",
};

type Props = { searchParams: Promise<{ error?: string }> };

async function signIn(formData: FormData) {
  'use server';
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        },
      },
    }
  );

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) redirect('/connexion?error=1');
  redirect('/portefeuille/personnel');
}

export default async function ConnexionPage({ searchParams }: Props) {
  const { error } = await searchParams;

  // Si déjà connectée, rediriger directement
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        },
      },
    }
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect('/portefeuille/personnel');

  return (
    <main className="page">
      <div className="connexion-wrap">
        <h1 className="connexion-title">Connexion</h1>
        <p className="connexion-subtitle">Accès propriétaire — portefeuille personnel</p>

        {error && (
          <p className="connexion-error" role="alert">
            Identifiants invalides. Vérifiez votre email et mot de passe.
          </p>
        )}

        <form action={signIn} className="connexion-form">
          <label className="connexion-label">
            <span>Email</span>
            <input
              type="email"
              name="email"
              required
              autoComplete="email"
              className="connexion-input"
            />
          </label>
          <label className="connexion-label">
            <span>Mot de passe</span>
            <input
              type="password"
              name="password"
              required
              autoComplete="current-password"
              className="connexion-input"
            />
          </label>
          <button type="submit" className="connexion-btn">
            Se connecter
          </button>
        </form>

        <p className="connexion-back">
          <a href="/">← Retour au dashboard</a>
        </p>
      </div>
    </main>
  );
}
