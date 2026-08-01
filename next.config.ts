import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // La page /indice rend le document de méthodologie depuis docs/*.md (source
  // unique, versionnée en git). Sans ce tracing explicite, le fichier n'est pas
  // embarqué dans le bundle serverless Netlify et la revalidation ISR échouerait
  // à le relire à l'exécution.
  outputFileTracingIncludes: {
    "/indice": ["./docs/**"],
  },
};

export default nextConfig;
