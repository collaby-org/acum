/**
 * Regional pricing — legacy entry point.
 *
 * The real implementation now lives in `@/lib/shared/pricing-utils` (one
 * source of truth, isomorphic). This module re-exports it under the names
 * the older call-sites used, plus a couple of helpers that used to live here
 * and are still referenced. Prefer importing from
 * `@/lib/shared/pricing-utils` (server + shared) or
 * `@/lib/pricing-client` (client components) in new code.
 */

export {
  REGIONAL_PRICING,
  COUNTRY_TO_REGION,
  getRegionCode,
  getRegionalPricing,
  formatRegionalPrice,
  getUserRegion,
  getRegionFromHeaders,
  type RegionCode,
  type CurrencyCode,
  type RegionalPrice,
  type PlanPricing,
} from "@/lib/shared/pricing-utils";

import {
  getRegionalPricing,
  formatRegionalPrice,
  type RegionCode,
  type CurrencyCode,
  type RegionalPrice,
} from "@/lib/shared/pricing-utils";

/**
 * The price of a single plan, in the given region (or the visitor's).
 */
export function getPlanPrice(
  planId: "free" | "monthly" | "household" | "lifetime",
  regionCode?: RegionCode,
): RegionalPrice {
  return getRegionalPricing(regionCode)[planId];
}

/**
 * The formatted price of a single plan.
 */
export function formatPriceForPlan(
  planId: "free" | "monthly" | "household" | "lifetime",
  regionCode?: RegionCode,
): string {
  return formatRegionalPrice(getPlanPrice(planId, regionCode));
}

/**
 * Every plan price for a region, keyed by plan id.
 */
export function getAllPlanPrices(
  regionCode?: RegionCode,
): Record<string, RegionalPrice> {
  return getRegionalPricing(regionCode);
}

/**
 * Format an amount already in minor units, for a given currency + locale.
 */
export function formatPriceClient(
  amount: number,
  currency: CurrencyCode,
  locale: string,
): string {
  return formatRegionalPrice({ amount, currency, symbol: currency, locale });
}

/**
 * Build a typed `RegionalPrice`. Handy for hand-rolled fallbacks.
 */
export function createRegionalPrice(
  amount: number,
  currency: CurrencyCode,
  symbol: string,
  locale: string,
): RegionalPrice {
  return { amount, currency, symbol, locale };
}
