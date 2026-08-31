/**
 * C1 — émission d'un événement Umami depuis du code client.
 *
 * Le projet mesure presque tout en DÉCLARATIF (`data-umami-event` sur un `<a>`
 * ou un `<button>`), et c'est la voie à préférer : rien à charger, rien à
 * typer. Cet helper n'existe que pour le cas où l'attribut ne sait pas dire ce
 * qu'on veut mesurer — le dépliage d'une ligne mobile (D4), où l'attribut
 * compterait le clic d'OUVERTURE et celui de FERMETURE sans les distinguer,
 * gonflant la métrique d'environ ×2 en silence.
 *
 * Le script Umami est chargé `afterInteractive` (layout.tsx) : il peut être
 * absent au moment de l'appel — chargement en cours, bloqueur de traceurs,
 * rendu serveur. L'appel est donc défensif et strictement sans effet de bord :
 * une mesure perdue est acceptable, une page cassée par le traceur ne l'est pas.
 */

type UmamiApi = {
  track: (event: string, data?: Record<string, string | number | boolean>) => void;
};

declare global {
  interface Window {
    umami?: UmamiApi;
  }
}

export function trackEvent(
  event: string,
  data?: Record<string, string | number | boolean>,
): void {
  if (typeof window === 'undefined') return;
  try {
    window.umami?.track(event, data);
  } catch {
    // Le traceur ne doit jamais interrompre une interaction.
  }
}
