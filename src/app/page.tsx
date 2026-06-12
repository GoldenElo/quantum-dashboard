export default function Home() {
  return (
    <main className="home">
      <div className="hero">
        <p className="label">L&apos;Investisseuse Quantique</p>
        <h1>Dashboard Quantique</h1>
        <p className="subtitle">
          Suivi de 3 portefeuilles fictifs à but pédagogique — bientôt disponible
        </p>
      </div>

      <footer className="disclaimer">
        À titre informatif uniquement. Ceci n&apos;est pas un conseil en investissement.
        Portefeuilles fictifs à but pédagogique. Données de clôture à J-1, sans garantie
        d&apos;exactitude.
        <br />
        <span className="sig">
          L&apos;Investisseuse Quantique · Analyse · Chiffres · Sans hype
        </span>
      </footer>
    </main>
  );
}
