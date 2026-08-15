'use client';

import { useSyncExternalStore } from 'react';
import { THEME_STORAGE_KEY, type ThemeMode } from './theme';

/**
 * Mode courant, lu depuis le DOM (l'attribut `data-theme` posé avant le paint
 * par THEME_INIT_SCRIPT). Le DOM est la source d'autorité : le CSS et le JS
 * lisent donc exactement la même chose, et un composant monté après un
 * basculement voit le bon mode sans plomberie de contexte.
 *
 * Réservé aux graphiques (Recharts / treemap SVG), qui reçoivent leurs couleurs
 * en props JS. Tout le reste de l'interface bascule en CSS pur, sans re-rendu.
 */

const read = (): ThemeMode =>
  document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';

function subscribe(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme'],
  });
  return () => observer.disconnect();
}

export function useThemeMode(): ThemeMode {
  // getServerSnapshot = 'light' : les graphiques sont tous en dynamic(ssr:false),
  // ils ne rendent jamais côté serveur — cette valeur n'est jamais peinte.
  return useSyncExternalStore(subscribe, read, () => 'light');
}

/** Bascule et persiste le choix. Le CSS suit l'attribut, le JS suit le MutationObserver. */
export function toggleThemeMode(): ThemeMode {
  const next: ThemeMode = read() === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, next);
  } catch {
    // Mode privé / stockage refusé : la bascule vaut pour la session, sans plus.
  }
  return next;
}

/** Un choix manuel a-t-il été posé ? (sinon l'OS continue de décider) */
export function hasStoredPreference(): boolean {
  try {
    const s = localStorage.getItem(THEME_STORAGE_KEY);
    return s === 'light' || s === 'dark';
  } catch {
    return false;
  }
}
