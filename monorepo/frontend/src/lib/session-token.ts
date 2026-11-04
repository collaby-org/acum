/**
 * The session the browser mirrors into a cookie.
 *
 * The cookie is the only session the server can see: a server cannot read
 * `localStorage`, where the browser keeps the real session. It carries the
 * access token — the one the desk reads — and nothing else.
 *
 * The refresh token stays where it was born: in the browser. The auth
 * server rotates it on every renewal, and a refresh token used twice from
 * two places can get the whole session revoked as a suspected theft. So
 * the server never renews with it. The browser refreshes on its own —
 * Supabase's client does it — and mirrors the new access token here, which
 * is the only thing the server ever needs.
 *
 * Everything in this file runs in every runtime the app uses: the browser
 * that writes the cookie, the proxy that reads it before the front door
 * opens, and the server that verifies it. No Node-only API, no client
 * library, no import that would drag the service-role module into a
 * bundle that must not have it.
 */

/** The cookie the account mirrors its session into. */
export const SESSION_COOKIE = "acum-session";

/**
 * How long the mirror lives.
 *
 * One hour: the life of the access token it carries. The browser rewrites
 * the cookie every minute while the page is open, so a visitor who stays
 * keeps a live mirror, and a visitor who closes the tab gets a cookie that
 * dies with the token inside it instead of lingering as a stale claim.
 */
export const SESSION_COOKIE_MAX_AGE = 60 * 60;

/** The session a cookie carries. */
export type MirroredSession = {
  access_token: string;
};

/** Base64url, decoded. Works in the browser, on the edge and in Node. */
export function decodeBase64Url(value: string): string {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = "=".repeat((4 - (padded.length % 4)) % 4);
  const binary = atob(padded + padding);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/** Base64url, encoded. */
export function encodeSessionCookie(session: MirroredSession): string {
  const bytes = new TextEncoder().encode(JSON.stringify(session));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** The session a cookie carries, or null when it carries none. */
export function decodeSessionCookie(
  value: string | undefined | null,
): MirroredSession | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(decodeBase64Url(value)) as MirroredSession;
    if (!parsed || typeof parsed.access_token !== "string") return null;
    if (!parsed.access_token) return null;
    return { access_token: parsed.access_token };
  } catch {
    return null;
  }
}

/** The moment a token stops being accepted, or null when it cannot be read. */
export function tokenExpiry(token: string): number | null {
  const claims = token.split(".")[1];
  if (!claims) return null;
  try {
    const parsed = JSON.parse(decodeBase64Url(claims)) as { exp?: unknown };
    if (typeof parsed.exp !== "number") return null;
    return parsed.exp * 1000;
  } catch {
    return null;
  }
}

/**
 * True when the token is good for a minute more.
 *
 * The minute is the margin: a token that is about to expire would send the
 * visitor through the front door and straight back out of it.
 */
export function tokenIsFresh(token: string): boolean {
  const expiry = tokenExpiry(token);
  if (expiry === null) return false;
  return expiry > Date.now() + 60_000;
}
