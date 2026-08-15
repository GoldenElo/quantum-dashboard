'use client';

import { useEffect } from 'react';
import { t } from '@/i18n/t';
import { THEME_STORAGE_KEY, type ThemeMode } from '@/lib/theme';
import { hasStoredPreference, toggleThemeMode, useThemeMode } from '@/lib/useThemeMode';

/**
 * Bascule clair / sombre (D3) — discrète, à côté des boutons sociaux.
 *
 * Les DEUX icônes sont dans le DOM et c'est le CSS qui choisit laquelle
 * s'affiche (`:root[data-theme="dark"]`). Conséquence : le bouton est correct
 * dès le HTML initial, avant même l'hydratation — aucune icône ne clignote au
 * chargement, et rien ne dépend d'un état React pour l'affichage.
 */
export default function ThemeToggle() {
  const mode: ThemeMode = useThemeMode();

  // Tant qu'aucun choix manuel n'est posé, l'OS reste maître : on suit ses
  // changements en direct (bascule automatique du système au coucher du soleil).
  // Dès qu'un choix est enregistré, il prime définitivement.
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onSystemChange = () => {
      if (hasStoredPreference()) return;
      document.documentElement.setAttribute('data-theme', mq.matches ? 'dark' : 'light');
    };
    mq.addEventListener('change', onSystemChange);

    // Le choix fait dans un autre onglet vaut pour celui-ci.
    const onStorage = (e: StorageEvent) => {
      if (e.key !== THEME_STORAGE_KEY) return;
      if (e.newValue === 'light' || e.newValue === 'dark') {
        document.documentElement.setAttribute('data-theme', e.newValue);
      }
    };
    window.addEventListener('storage', onStorage);

    return () => {
      mq.removeEventListener('change', onSystemChange);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={() => toggleThemeMode()}
      aria-label={mode === 'dark' ? t.theme.versClair : t.theme.versSombre}
      title={t.theme.titre}
      data-umami-event="clic-theme"
    >
      {/* Mode clair affiché → on propose la lune */}
      <svg
        className="theme-icon theme-icon-moon" width="15" height="15"
        viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
      >
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
      </svg>
      {/* Mode sombre affiché → on propose le soleil */}
      <svg
        className="theme-icon theme-icon-sun" width="15" height="15"
        viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
      >
        <circle cx="12" cy="12" r="4.2" />
        <path d="M12 1.8v2.4M12 19.8v2.4M4.2 4.2l1.7 1.7M18.1 18.1l1.7 1.7M1.8 12h2.4M19.8 12h2.4M4.2 19.8l1.7-1.7M18.1 5.9l1.7-1.7" />
      </svg>
    </button>
  );
}
