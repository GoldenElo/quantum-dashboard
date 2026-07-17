import type { Metadata } from "next";
import { IBM_Plex_Sans, Inter, JetBrains_Mono } from "next/font/google";
import Script from "next/script";
import Footer from "@/components/Footer";
import SiteHeader from "@/components/SiteHeader";
import { t } from "@/i18n/t";
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

// URL de production — domaine officiel. L'ancien quantum-wall.netlify.app redirige en 301.
const SITE_URL = "https://thequantumwall.com";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: t.meta.title,
    template: t.meta.titleTemplate,
  },
  description: t.meta.description,
  applicationName: t.meta.siteName,
  openGraph: {
    title: t.meta.title,
    description: t.meta.description,
    siteName: t.meta.siteName,
    locale: "fr_FR",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: t.meta.title,
    description: t.meta.description,
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr" className={`${ibmPlexSans.variable} ${inter.variable} ${jetbrainsMono.variable}`}>
      <body>
        {/* Analytics Umami Cloud — cookieless, sans bannière RGPD. Chargé après l'hydratation. */}
        <Script
          src="https://cloud.umami.is/script.js"
          data-website-id="587d3c04-a8a9-4c31-b70e-18b37be6efe6"
          strategy="afterInteractive"
        />
        <div className="site-wrapper">
          <SiteHeader />
          {children}
          <Footer />
        </div>
      </body>
    </html>
  );
}
