import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "L'Investisseuse Quantique — Dashboard Quantique",
  description:
    "Suivi de 3 portefeuilles quantiques fictifs à but pédagogique. Données de clôture à J-1.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
