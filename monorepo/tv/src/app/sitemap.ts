import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/**
 * The sitemap.
 *
 * The guide lives under its own routes, so every page a crawler can reach
 * is listed here. The catalogue itself is behind an account: anonymous
 * crawlers are redirected away, so its URLs would only cost crawl budget.
 * There is no `lastModified`:
 * the catalogue is rebuilt by a script, not by a request, and a timestamp
 * that cannot be read off the build would only be a guess.
 */
const PAGES: { path: string; priority: number; changeFrequency: "daily" | "weekly" | "monthly" }[] = [
  { path: "/", priority: 1, changeFrequency: "weekly" },
  { path: "/trending", priority: 0.8, changeFrequency: "daily" },
  { path: "/azi", priority: 0.8, changeFrequency: "daily" },
  { path: "/ghid", priority: 0.7, changeFrequency: "daily" },
  { path: "/cauta-o-emisiune", priority: 0.6, changeFrequency: "weekly" },
  { path: "/meciuri", priority: 0.6, changeFrequency: "daily" },
  { path: "/top-emisiuni", priority: 0.5, changeFrequency: "weekly" },
  { path: "/maine", priority: 0.5, changeFrequency: "daily" },
  { path: "/saptamana", priority: 0.5, changeFrequency: "weekly" },
  { path: "/diaspora", priority: 0.4, changeFrequency: "weekly" },
  { path: "/ghid-tv", priority: 0.4, changeFrequency: "monthly" },
  { path: "/preturi", priority: 0.6, changeFrequency: "monthly" },
];

export default function sitemap(): MetadataRoute.Sitemap {
  return PAGES.map((page) => ({
    url: `${SITE_URL}${page.path}`,
    changeFrequency: page.changeFrequency,
    priority: page.priority,
  }));
}
