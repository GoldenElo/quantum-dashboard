import type { Metadata } from "next";
import { IBM_Plex_Sans, Inter, JetBrains_Mono } from "next/font/google";
import Footer from "@/components/Footer";
import "./globals.css";

const ibmPlexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-heading",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "L'Investisseuse Quantique — Dashboard Quantique",
  description:
    "Suivi de 3 portefeuilles quantiques fictifs à but pédagogique. Données de clôture à J-1.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr" className={`${ibmPlexSans.variable} ${inter.variable} ${jetbrainsMono.variable}`}>
      <body>
        <div className="site-wrapper">
          {children}
          <Footer />
        </div>
      </body>
    </html>
  );
}
