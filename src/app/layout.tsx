import type { Metadata, Viewport } from "next";
import { PwaRegister } from "@/components/pwa";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://vizor.tv"),
  title: {
    default: "VIZOR — TV live românesc, fără reclame",
    template: "%s · VIZOR",
  },
  description:
    "Toate canalele TV românești într-un singur loc. Fără cont, fără reclame, fără probleme. Vizionează direct, caută instant și salvează-ți favoritele.",
  applicationName: "VIZOR",
  keywords: ["tv live", "canale tv", "romania", "stream", "vizor", "televiziune"],
  authors: [{ name: "VIZOR" }],
  openGraph: {
    type: "website",
    locale: "ro_RO",
    siteName: "VIZOR",
    title: "VIZOR — TV live românesc, fără reclame",
    description:
      "Toate canalele TV românești într-un singur loc. Fără cont, fără reclame.",
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
