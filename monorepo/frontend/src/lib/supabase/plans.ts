/**
 * The plan catalogue.
 *
 * The names, the prices and the promises live in `src/lib/site.ts` — the
 * one place the product's identity is. This module only adds what the
 * database, the paywall and the payment route need on top of that: the
 * plan ids, the seats of each plan, the daily allowance and the products
 * that can be bought.
 *
 * The prices are read from one place, so the pricing page, the landing
 * page, the paywall and the payment route cannot drift apart.
 */
import { FREE_DAILY_MINUTES, PLANS as SITE_PLANS } from "@/lib/site";
import {
  getRegionalPricing,
  type RegionCode,
  type RegionalPrice,
} from "@/lib/shared/pricing-utils";

/** The plans an account can be on. `comp` is what the desk grants by hand. */
export type Plan = "free" | "monthly" | "lifetime" | "household" | "comp";

/** The products that can be bought. Mirrors the check on `subscriptions`. */
export type Product = "monthly" | "household" | "lifetime";

/** How many people share a plan. */
const SEATS: Record<string, number> = {
  free: 1,
  monthly: 1,
  household: 4,
  lifetime: 1,
};

export type PlanDefinition = {
  /** The plan on the profile row. */
  id: Plan;
  /** What the product is called, in the interface. */
  name: string;
  /** One line under the name. */
  tagline: string;
  /** The price in minor units (cents, bani, yen) for each plan tier. */
  regionalPrice: Record<string, RegionalPrice>;
  /** `per month` or `once` — how the price is charged. */
  cadence: "free" | "month" | "once";
  /** How many people share the plan. */
  seats: number;
  /** The daily allowance in seconds; `null` means no limit. */
  allowanceSeconds: number | null;
  /** What the plan gives, as a short list. */
  features: string[];
  /** True for the plan the page puts in the middle. */
  featured?: boolean;
};

/**
 * Get the regional pricing for all plans.
 */
export function getPlansWithRegionalPricing(regionCode?: RegionCode): PlanDefinition[] {
  const pricing = getRegionalPricing(regionCode);
  
  return SITE_PLANS.map((plan) => ({
    id: plan.id as Plan,
    name: plan.name,
    tagline: plan.blurb,
    regionalPrice: {
      free: pricing.free,
      monthly: pricing.monthly,
      household: pricing.household,
      lifetime: pricing.lifetime,
    },
    cadence:
      plan.price === null ? "free" : plan.period === "o dată" ? "once" : "month",
    seats: SEATS[plan.id] ?? 1,
    allowanceSeconds: plan.minutes === null ? null : plan.minutes * 60,
    features: [...plan.features],
    featured: plan.id === "household",
  }));
}

/** The plans, in the order the product shows them. */
export const PLANS: PlanDefinition[] = getPlansWithRegionalPricing();

/** The plan a visitor starts on. */
export const DEFAULT_PLAN: Plan = "free";

/** The plans that can be bought. */
export const PRODUCTS: Product[] = ["monthly", "household", "lifetime"];

/** The free plan's daily allowance, in minutes. */
export const FREE_ALLOWANCE_MINUTES = FREE_DAILY_MINUTES;

/** The free plan's daily allowance, in seconds. */
export const FREE_ALLOWANCE_SECONDS = FREE_ALLOWANCE_MINUTES * 60;

/**
 * The free tier's allowance, in hours, written the way it is spoken.
 *
 * "Două ore pe zi" reads better than "2 ore pe zi" in a sentence, and the
 * sentence is where the allowance is explained.
 */
export function freeHours(): string {
  const hours = FREE_ALLOWANCE_MINUTES / 60;
  if (hours === 2) return "două";
  return String(hours);
}

/** The plan definition of a plan id. */
export function planDefinition(
  id: Plan | string | null | undefined,
): PlanDefinition {
  return (
    PLANS.find((plan) => plan.id === id) ??
    (PLANS[0] as PlanDefinition)
  );
}

/** The plan definition of a product id. */
export function productDefinition(
  product: Product | string | null | undefined,
): PlanDefinition | null {
  return PLANS.find((plan) => plan.id === product) ?? null;
}

/** True when the product is one that can be bought. */
export function isProduct(value: unknown): value is Product {
  return typeof value === "string" && (PRODUCTS as string[]).includes(value);
}

/**
 * The period a price is charged over.
 *
 * Kept apart from the amount so a card can set the number large and the
 * period small, without the two wrapping into each other.
 */
export function cadenceLabel(plan: PlanDefinition): string {
  if (plan.cadence === "month") return "/ lună";
  if (plan.cadence === "once") return "o singură dată";
  return "";
}

/**
 * The daily allowance of a plan, in minutes.
 *
 * `null` means there is no limit. The desk's `comp` plan gets the same as
 * a paid one.
 */
export function allowanceMinutes(
  plan: Plan | string | null | undefined,
): number | null {
  if (plan === "comp") return null;
  const definition = planDefinition(plan);
  if (definition.allowanceSeconds === null) return null;
  return definition.allowanceSeconds / 60;
}

/* ------------------------------------------------------------------ *
 * The streams a plan may run at once
 *
 * One account, a number of screens. The free tier is one: the same person
 * on a phone and a laptop is two streams, and two hours a day is not two
 * hours a day per screen. The individual plan is two — a phone and a
 * television. The household plan is four, one per seat, and the lifetime
 * plan carries the household promise for as long as it lasts.
 *
 * `comp` is the desk's own: it counts nothing.
 * ------------------------------------------------------------------ */

/** How many streams a plan may run at the same time. */
const STREAM_LIMITS: Record<Plan, number | null> = {
  free: 1,
  monthly: 2,
  household: 4,
  lifetime: 4,
  comp: null,
};

/**
 * The concurrent streams a plan allows, or `null` for no limit.
 *
 * `bypass` is a desk flag rather than a plan, and it is handled next to the
 * plan — a bypassed account is never counted.
 */
export function streamLimit(
  plan: Plan | string | null | undefined,
): number | null {
  if (!plan || !(plan in STREAM_LIMITS)) return null;
  return STREAM_LIMITS[plan as Plan];
}

/**
 * Whether a plan is tied to a household.
 *
 * The household plan is one payment for one home, and the lifetime plan
 * inherits it. A sign-in from a device that is not the one the house plays
 * on is not refused outright: it is asked to confirm the household, the way
 * the streaming services do when somebody travels.
 */
export function bindsHousehold(plan: Plan | string | null | undefined): boolean {
  return plan === "household" || plan === "lifetime";
}
