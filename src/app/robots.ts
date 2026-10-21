import type { MetadataRoute } from "next";

/** The one canonical origin. Mirrors `metadataBase` in `src/app/layout.tsx`. */
const BASE_URL = "https://vizor.tv";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // The stream resolver is not a page and has nothing to index.
        disallow: ["/api/"],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
    host: BASE_URL,
  };
}
