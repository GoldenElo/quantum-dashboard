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
    // Images OG (C4) : la police de titrage est embarquée en fichier et lue avec
    // fs à la génération. Sans ce tracing, le .ttf n'est pas dans le bundle
    // serverless Netlify et la revalidation ISR des cartes échouerait — même
    // raison que docs/ pour /indice.
    "/opengraph-image": ["./src/assets/fonts/**"],
    "/societe/[ticker]/opengraph-image": ["./src/assets/fonts/**"],
    "/indice/opengraph-image": ["./src/assets/fonts/**"],
  },
};

export default nextConfig;
