const YOUTUBE_URL = 'https://www.youtube.com/@InvestisseuseQuantique';
const X_URL = 'https://x.com/InvestQuantique';

export default function SiteHeader() {
  return (
    <header className="site-header">
      <div className="site-header-inner">

        {/* Marque — gauche */}
        <a href="/" className="site-header-brand" aria-label="L'Investisseuse Quantique — accueil">
          <span className="site-header-name">L&apos;Investisseuse Quantique</span>
        </a>

        {/* Slot de navigation — V2 : indices sectoriels / V3 : vue secteur */}
        <nav className="site-header-nav" aria-label="Navigation principale">
          <a href="/#heatmap" className="site-header-navlink">HeatMap</a>
        </nav>

        {/* Actions — droite */}
        <div className="site-header-actions">
          <a
            href={YOUTUBE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="site-header-yt"
            aria-label="Chaîne YouTube L'Investisseuse Quantique (nouvel onglet)"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2C0 8.1 0 12 0 12s0 3.9.5 5.8a3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1C24 15.9 24 12 24 12s0-3.9-.5-5.8zM9.75 15.5V8.5l6.25 3.5-6.25 3.5z"/>
            </svg>
            YouTube
          </a>
          <a
            href={X_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="site-header-yt"
            aria-label="Compte X L'Investisseuse Quantique (nouvel onglet)"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
            </svg>
            X
          </a>
        </div>

      </div>
    </header>
  );
}
