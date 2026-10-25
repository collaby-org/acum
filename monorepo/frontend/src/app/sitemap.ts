import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/**
 * The sitemap.
 *
 * The catalogue is at `/` and the guide lives under its own routes, so
 * every page a crawler can reach is listed here. There is no `lastModified`:
 * the catalogue is rebuilt by a script, not by a request, and a timestamp
 * that cannot be read off the build would only be a guess.
 */
const PAGES: { path: string; priority: number; changeFrequency: "daily" | "weekly" | "monthly" }[] = [
  { path: "/", priority: 1, changeFrequency: "weekly" },
  { path: "/canale", priority: 1, changeFrequency: "daily" },
  { path: "/canale/toate", priority: 0.9, changeFrequency: "daily" },
  { path: "/canale/grupate", priority: 0.7, changeFrequency: "weekly" },
  { path: "/trending", priority: 0.8, changeFrequency: "daily" },
  { path: "/azi", priority: 0.8, changeFrequency: "daily" },
  { path: "/ghid", priority: 0.7, changeFrequency: "daily" },
  { path: "/cauta-o-emisiune", priority: 0.6, changeFrequency: "weekly" },
  { path: "/meciuri", priority: 0.6, changeFrequency: "daily" },
  { path: "/top-emisiuni", priority: 0.5, changeFrequency: "weekly" },
  { path: "/maine", priority: 0.5, changeFrequency: "daily" },
  { path: "/saptamana", priority: 0.5, changeFrequency: "weekly" },
  { path: "/diaspora", priority: 0.4, changeFrequency: "weekly" },
  { path: "/despre", priority: 0.4, changeFrequency: "monthly" },
  { path: "/ghid-tv", priority: 0.4, changeFrequency: "monthly" },
  { path: "/intrebari", priority: 0.4, changeFrequency: "monthly" },
  { path: "/propune-un-canal", priority: 0.4, changeFrequency: "monthly" },
  { path: "/contact", priority: 0.4, changeFrequency: "monthly" },
  { path: "/preturi", priority: 0.6, changeFrequency: "monthly" },
  { path: "/termeni", priority: 0.3, changeFrequency: "monthly" },
  { path: "/confidentialitate", priority: 0.3, changeFrequency: "monthly" },
  { path: "/cookies", priority: 0.3, changeFrequency: "monthly" },
  { path: "/dmca", priority: 0.3, changeFrequency: "monthly" },
  { path: "/disclaimer", priority: 0.3, changeFrequency: "monthly" },
];

export default function sitemap(): MetadataRoute.Sitemap {
  return PAGES.map((page) => ({
    url: `${SITE_URL}${page.path}`,
    changeFrequency: page.changeFrequency,
    priority: page.priority,
  }));
}
