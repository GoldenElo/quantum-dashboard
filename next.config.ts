import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // La page /indice rend le document de méthodologie depuis docs/*.md (source
  // unique, versionnée en git). Sans ce tracing explicite, le fichier n'est pas
  // embarqué dans le bundle serverless Netlify et la revalidation ISR échouerait
  // à le relire à l'exécution.
  // Idem pour /grille-etf, qui rend docs/grille-5-criteres-etf.fr.md.
  outputFileTracingIncludes: {
    "/indice": ["./docs/**"],
    "/grille-etf": ["./docs/**"],
  },
};

export default nextConfig;
