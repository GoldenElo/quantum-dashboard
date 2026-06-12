const YOUTUBE_URL = 'https://www.youtube.com/@InvestisseuseQuantique';

export default function Footer() {
  return (
    <footer className="site-footer">
      <p className="footer-disclaimer">
        <strong>À titre informatif uniquement. Ceci n&apos;est pas un conseil en investissement.</strong>{' '}
        Portefeuilles fictifs à but pédagogique. Données de clôture à J&#8209;1, sans garantie d&apos;exactitude.
      </p>
      <p className="footer-sig">
        L&apos;Investisseuse Quantique · Analyse · Chiffres · Sans hype
        {' · '}
        <a
          href={YOUTUBE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="footer-yt-link"
        >
          YouTube ↗
        </a>
        {' · '}
        <a href="/connexion" className="footer-auth-link">
          Connexion
        </a>
      </p>
    </footer>
  );
}
