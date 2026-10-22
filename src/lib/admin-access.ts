/**
 * The desk mark, in the shape the browser can hold.
 *
 * This module is deliberately tiny and has no imports: the navbar and the
 * channel card need to know whether the visitor is an administrator, and both
 * of them run in the browser. `@/lib/admin` cannot be used for that — it reads
 * the cookie jar and the service role, and a client component importing it
 * would drag server-only code into the bundle.
 *
 * So the rule lives here, once, and the server module re-exports it. The
 * server is still the only place that *enforces* it: `deskState()` in
 * `@/lib/admin` decides who may open `/admin` and every `/api/admin` route.
 * What is here only decides whether the menu shows the door.
 */

/** The e-mail that is let in without a plan of its own. */
export const ADMIN_EMAIL = "gmgmethereum@gmail.com";

/**
 * Whether an account carries the desk mark.
 *
 * The e-mail match is the owner's account; `comp` is handed out by the desk
 * itself; `bypass` is a comp that also skips the paywall.
 */
export function isAdmin(
  email?: string | null,
  plan?: string | null,
): boolean {
  if (email && email.toLowerCase() === ADMIN_EMAIL.toLowerCase()) return true;
  return plan === "comp" || plan === "bypass";
}
