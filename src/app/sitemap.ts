import type { MetadataRoute } from "next";

/** The one canonical origin. Mirrors `metadataBase` in `src/app/layout.tsx`. */
const BASE_URL = "https://vizor.tv";

/**
 * The sitemap.
 *
 * VIZOR is a single page: the catalogue, the search and the player all live
 * at `/`. There are no channel pages to list yet — `/canal/<slug>` is still
 * on the roadmap (`docs/roadmap.md`, "Shareable deep links") — so the sitemap
 * stays honest and lists only what a crawler can actually reach.
 *
 * When the deep links ship, add one entry per channel here.
 *
 * There is no `lastModified`: the catalogue is rebuilt by a script, not by a
 * request, and a timestamp that cannot be read off the build would only be a
 * guess.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: `${BASE_URL}/`,
      changeFrequency: "weekly",
      priority: 1,
    },
  ];
}
