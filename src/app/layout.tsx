import type { Metadata, Viewport } from "next";
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
  themeColor: "#06070a",
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
          href="/fonts/inter-400-700-latin.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
      </head>
      <body className="min-h-full bg-canvas text-ink">{children}</body>
    </html>
  );
}
