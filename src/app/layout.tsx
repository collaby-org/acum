import type { Metadata, Viewport } from "next";
import { FirstVisitIntro } from "@/components/intro";
import { PwaRegister } from "@/components/pwa";
import { REPO_RAW, SITE_NAME, SITE_TAGLINE, SITE_URL } from "@/lib/site";
import "./globals.css";

/**
 * The Open Graph card, addressed absolutely.
 *
 * The app has no domain of its own yet, so the card is read from the
 * repository, where it is committed. A scraper that receives a relative path
 * has no way to resolve it; this one it can.
 */
const OG_IMAGE = `${REPO_RAW}/public/brand/og.png`;

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — ${SITE_TAGLINE}`,
    template: `%s · ${SITE_NAME}`,
  },
  description:
    "Ce rulează acum pe canalele din România: 156 de canale live într-un singur loc, cu ghid de programe și cifre de audiență în timp real. Fără reclame, fără urmărire. Plan gratuit cu două ore pe zi.",
  applicationName: SITE_NAME,
  keywords: [
    "tv live",
    "canale tv",
    "romania",
    "stream",
    "acum",
    "acum tv",
    "ce ruleaza acum",
    "televiziune",
    "live tv",
    "ghid tv",
    "fara reclame",
  ],
  authors: [{ name: SITE_NAME }],
  creator: SITE_NAME,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "ro_RO",
    siteName: SITE_NAME,
    title: `${SITE_NAME} — ${SITE_TAGLINE}`,
    description:
      "Ce rulează acum pe canalele din România: 156 de canale live într-un singur loc, cu ghid de programe și cifre de audiență în timp real. Fără reclame, fără urmărire.",
    url: SITE_URL,
    images: [
      {
        url: OG_IMAGE,
        width: 1200,
        height: 630,
        alt: `${SITE_NAME} — ${SITE_TAGLINE}`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} — ${SITE_TAGLINE}`,
    description:
      "Ce rulează acum pe canalele din România: 156 de canale live, cu ghid de programe și cifre de audiență în timp real. Fără reclame, fără urmărire.",
    images: [OG_IMAGE],
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#04050a",
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ro" data-scroll-behavior="smooth" className="h-full antialiased">
      <head>
        <link
          rel="preload"
          href="/fonts/space-grotesk-700-latin.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          href="/fonts/space-grotesk-500-latin.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          href="/fonts/inter-400-700-latin.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
      </head>
      <body className="min-h-full bg-canvas font-sans text-ink">
        {/* The sting. First visit on this device only, and it never holds
            the catalogue back — it is an overlay on top of it. */}
        <FirstVisitIntro />
        {children}
        {/* One grain tile over the whole product, under the dialogs. */}
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 z-[45] fx-grain opacity-[0.035] mix-blend-overlay"
        />
        {/* Registers the service worker and declares the install metadata. */}
        <PwaRegister />
      </body>
    </html>
  );
}
