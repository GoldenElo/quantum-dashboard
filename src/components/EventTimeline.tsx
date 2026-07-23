import type { SectorEvent } from '@/lib/api';
import { formatDateCompact } from '@/lib/format';
import { t } from '@/i18n/t';

// Familles de couleur des badges type — charte CLAIRE, discrètes (fond teinté
// léger, texte foncé, jamais de cyan vif). Une classe CSS par famille.
const TYPE_FAMILY: Record<string, string> = {
  dilution: 'neg',
  reverse_split: 'neg',
  contrat: 'teal',
  resultats: 'teal',
  acquisition: 'teal',
  ipo: 'or',
  spac: 'or',
  reglementaire: 'grey',
  technologie: 'grey',
  autre: 'grey',
};

// Libellé de source : source_label si présent, sinon l'hôte de l'URL (sans www).
function sourceLabel(ev: SectorEvent): string {
  if (ev.source_label) return ev.source_label;
  try {
    return new URL(ev.source_url).hostname.replace(/^www\./, '');
  } catch {
    return ev.source_url;
  }
}

export default function EventTimeline({ events, ticker }: { events: SectorEvent[]; ticker: string }) {
  // Contrat d'appel : le parent n'affiche la frise que si events.length > 0
  // (sinon le placeholder "Bientôt" reste). Garde-fou défensif malgré tout.
  if (events.length === 0) return null;

  // Date du jour (UTC — cohérent J-1 clôture US) au format ISO 'YYYY-MM-DD'.
  // Les event_date étant en ISO, la comparaison lexicographique suffit. Rendu au
  // build/ISR (revalidation 24 h) : le statut « à venir » se rafraîchit chaque jour.
  const todayIso = new Date().toISOString().slice(0, 10);

  return (
    <ol className="evt-timeline" aria-label={t.evenements.aria.frise}>
      {events.map(ev => {
        const family = TYPE_FAMILY[ev.type] ?? 'grey';
        const typeLabel = t.evenements.types[ev.type] ?? ev.type;
        // event_date postérieure à aujourd'hui → événement prospectif. Les événements
        // sont triés event_date DESC, donc les « à venir » sont en tête de frise.
        const upcoming = ev.event_date > todayIso;
        return (
          <li key={ev.id} className={`evt-item${upcoming ? ' evt-item-upcoming' : ''}`}>
            <div className="evt-head">
              <span className="evt-date mono">{formatDateCompact(ev.event_date)}</span>
              <span className={`evt-badge evt-badge-${family}`}>{typeLabel}</span>
              {upcoming && (
                <span className="evt-badge evt-badge-upcoming" aria-label={t.evenements.aria.aVenir}>
                  {t.evenements.aVenir}
                </span>
              )}
            </div>
            <h3 className="evt-title">{ev.title}</h3>
            {ev.description && <p className="evt-desc">{ev.description}</p>}
            <a
              className="evt-source"
              href={ev.source_url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={t.evenements.aria.lienSource}
              data-umami-event="clic-source-evenement"
              data-umami-event-ticker={ticker}
              data-umami-event-type={ev.type}
            >
              {t.evenements.sourcePrefix} {sourceLabel(ev)} ↗
            </a>
          </li>
        );
      })}
    </ol>
  );
}
