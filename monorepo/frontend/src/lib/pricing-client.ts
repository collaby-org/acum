"use client";

/**
 * Client-side pricing.
 *
 * The isomorphic core in `@/lib/shared/pricing-utils` already runs in the
 * browser — every `document` access is guarded by `typeof window` — so this
 * module is only the React seam: a hook that reads the region once, on the
 * first client render, with no effect.
 *
 * The region cannot change while a page is mounted (a geo cookie and a
 * device timezone do not move mid-session), so a lazy `useState` initialiser
 * is the whole mechanism: the first client render already carries the right
 * prices and there is no flash of the fallback region.
 */

import { useState } from "react";
import {
  REGIONAL_PRICING,
  getRegionCode,
  getUserRegion,
  timezoneToCountry,
  type PlanPricing,
  type RegionCode,
} from "@/lib/shared/pricing-utils";

export { formatRegionalPrice, getRegionalPricing } from "@/lib/shared/pricing-utils";
export type { CurrencyCode, PlanPricing, RegionCode, RegionalPrice } from "@/lib/shared/pricing-utils";

/** The visitor's region, read once from the cookie, then the timezone. */
function readRegion(): RegionCode {
  // The lazy initialiser runs during server rendering too; there is no
  // document there, so the server paints the fallback and the first
  // client render carries the region.
  if (typeof document === "undefined") return "DEFAULT";

  const vercelCountry = document.cookie.match(/vercel-country=([^;]+)/)?.[1];
  if (vercelCountry) return getRegionCode(vercelCountry);

  try {
    const country = timezoneToCountry(
      Intl.DateTimeFormat().resolvedOptions().timeZone,
    );
    if (country) return getRegionCode(country);
  } catch {
    // A browser without `Intl` keeps the fallback region.
  }

  return getUserRegion();
}

/**
 * Hook: the visitor's region and its prices, resolved on the first render.
 *
 * A `region` given by the server (read from the geo header) wins: the page
 * then shows one price from the first byte, and hydration agrees with the
 * server. Without it the browser's own region is detected on the first
 * client render — the fallback for surfaces the server renders generically.
 */
export function useRegionalPricing(serverRegion?: RegionCode): {
  pricing: PlanPricing;
  region: RegionCode;
} {
  const [detected] = useState<RegionCode>(readRegion);
  const region = serverRegion ?? detected;
  const pricing = REGIONAL_PRICING[region] ?? REGIONAL_PRICING.DEFAULT;

  return { pricing, region };
}
