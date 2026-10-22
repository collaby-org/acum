/**
 * The one place the product's identity and its canonical address live.
 *
 * The site has no domain of its own yet, so the canonical origin points at
 * the project's home on GitHub. When the app is deployed somewhere of its
 * own, this is the single line to change — the metadata, the sitemap, the
 * robots file and the manifest all read from here.
 */

/** The product's name. */
export const SITE_NAME = "ACUM";

/**
 * The promise, in one line.
 *
 * It used to be "TV live românesc, fără reclame" and then gained "fără
 * cont" — no account, nothing to sign up for. That is no longer true: there
 * is an account now, a free tier with two hours a day, and a paid plan that
 * removes the limit. The promise that survives all of that is the one the
 * product has always actually been about — **no adverts, ever** — plus the
 * thing that makes it different from the directories it indexes: the stream
 * is relayed through our own proxy, so there is no ad window, no tracker and
 * no script from anyone else's site in the browser.
 */
export const SITE_TAGLINE = "TV live românesc, fără reclame";

/**
 * The second half of the promise, for the places that can carry a sentence.
 *
 * "Fără reclame" alone is a claim every directory makes. What is true here
 * and is not true there is that the picture comes from our own player and
 * our own proxy — so there is nothing else in the page to run, and nothing
 * to sign up for to watch the free tier.
 */
export const SITE_PROMISE = "Fără reclame, fără urmărire, fără reclame ascunse.";

/** The short form of the promise, for a chip or a badge. */
export const SITE_PROMISE_SHORT = "Fără reclame";

/** The canonical origin. */
export const SITE_URL = "https://collaby-org.github.io/acum";

/**
 * The assets that are addressed from outside the app — the Open Graph card
 * and the social preview — have to be absolute, because a scraper that
 * receives a relative path has no way to resolve it. The repository is the
 * origin for those until the app is deployed.
 */
export const REPO_RAW = "https://raw.githubusercontent.com/collaby-org/acum/main";

/** The free tier's allowance, in minutes a day. */
export const FREE_DAILY_MINUTES = 120;

/**
 * The plans, in the order they are shown.
 *
 * The prices live here so that the pricing page, the landing page and the
 * paywall cannot drift apart.
 */
export const PLANS = [
  {
    id: "free",
    name: "Gratuit",
    price: null,
    period: null,
    minutes: FREE_DAILY_MINUTES,
    blurb: "Două ore pe zi, cât timp vrei.",
    features: [
      "Toate cele 156 de canale",
      "Două ore pe zi",
      "Ghid de programe și «acum»",
      "Fără reclame, fără urmărire",
    ],
  },
  {
    id: "monthly",
    name: "Individual",
    price: 3.99,
    period: "lună",
    minutes: null,
    blurb: "Nelimitat, pentru o singură persoană.",
    features: [
      "Tot ce este în planul gratuit",
      "Vizionare fără limită",
      "Un singur cont",
    ],
  },
  {
    id: "household",
    name: "Casă",
    price: 5.99,
    period: "lună",
    minutes: null,
    blurb: "Nelimitat, pentru toată familia.",
    features: [
      "Tot ce este în planul individual",
      "Vizionare fără limită",
      "Până la patru conturi din aceeași casă",
    ],
  },
  {
    id: "lifetime",
    name: "De o viață",
    price: 39.99,
    period: "o dată",
    minutes: null,
    blurb: "Plătești o singură dată.",
    features: [
      "Tot ce este în planul casă",
      "Vizionare fără limită, pentru totdeauna",
      "Fără renumerări",
    ],
  },
] as const;

/** The plan's price, formatted the way a price is written in Romanian. */
export function formatPrice(price: number): string {
  return `${price.toFixed(2).replace(".", ",")} £`;
}
