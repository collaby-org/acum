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

/** One line about what the product is, in Romanian. */
export const SITE_TAGLINE = "TV live românesc, fără reclame";

/** The canonical origin. */
export const SITE_URL = "https://collaby-org.github.io/acum";

/**
 * The assets that are addressed from outside the app — the Open Graph card
 * and the social preview — have to be absolute, because a scraper that
 * receives a relative path has no way to resolve it. The repository is the
 * origin for those until the app is deployed.
 */
export const REPO_RAW = "https://raw.githubusercontent.com/collaby-org/acum/main";
