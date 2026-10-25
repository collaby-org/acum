"use client";

/**
 * Client-side pricing.
 *
 * Thin wrapper over the isomorphic source of truth in
 * `@/lib/shared/pricing-utils`. That module already runs on the client — it
 * guards every `document` access behind `typeof window` — so this file only
 * adds the React hook and re-exports the helpers under client-friendly names
 * so components never import server-only modules.
 */

import { useEffect, useState } from "react";
import {
  REGIONAL_PRICING,
  formatRegionalPrice,
  getRegionalPricing,
  getRegionCode,
  getUserRegion,
  timezoneToCountry,
  type CurrencyCode,
  type PlanPricing,
  type RegionCode,
  type RegionalPrice,
} from "@/lib/shared/pricing-utils";

export {
  formatRegionalPrice,
  getRegionalPricing,
  type CurrencyCode,
  type PlanPricing,
  type RegionCode,
  type RegionalPrice,
};

/**
 * The visitor's region, on the client.
 *
 * Alias of the shared `getUserRegion`, which is already safe in the browser.
 * Kept as a distinct name so client components read as client code.
 */
export function getUserRegionClient(): RegionCode {
  return getUserRegion();
}

/**
 * Hook: the visitor's region and pricing, resolved once on mount.
 *
 * Server HTML always renders `DEFAULT` (euro) so the first paint is stable;
 * after mount the real region replaces it. Consumers should therefore avoid
 * layout that shifts when the currency symbol changes length.
 */
export function useRegionalPricing(): {
  pricing: PlanPricing;
  region: RegionCode;
  loading: boolean;
} {
  const [pricing, setPricing] = useState<PlanPricing>(REGIONAL_PRICING.DEFAULT);
  const [region, setRegion] = useState<RegionCode>("DEFAULT");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const vercelCountry = document.cookie.match(/vercel-country=([^;]+)/)?.[1];
    let next: RegionCode = "DEFAULT";

    if (vercelCountry) {
      next = getRegionCode(vercelCountry);
    } else {
      try {
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const country = timezoneToCountry(timezone);
        if (country) next = getRegionCode(country);
      } catch {
        // No `Intl`: stay on the default.
      }
    }

    setRegion(next);
    setPricing(
      (REGIONAL_PRICING as Record<string, PlanPricing>)[next] ??
        REGIONAL_PRICING.DEFAULT,
    );
    setLoading(false);
  }, []);

  return { pricing, region, loading };
}
