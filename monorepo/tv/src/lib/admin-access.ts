/**
 * The desk mark.
 *
 * This module carries no credential and no account data. The e-mail
 * allowlist is read on the server and handed in by the caller; a browser
 * bundle can therefore use the helper without learning who owns the desk.
 *
 * The rule is deliberately narrow: an account is a desk account only when
 * its e-mail is on the server's allowlist or its plan is `comp`. The desk's
 * `bypass` flag lifts the paywall, but it never grants administrative
 * access.
 */

/**
 * Whether an account carries the desk mark.
 *
 * The e-mail match is case-insensitive. `comp` is handed out by the desk
 * itself and is not user-writable. `bypass` is deliberately absent: it is a
 * paywall exemption, not an administrative credential.
 */
export function isAdmin(
  email?: string | null,
  plan?: string | null,
  allowedEmails: ReadonlySet<string> = new Set<string>(),
): boolean {
  if (plan === "comp") return true;
  if (!email) return false;

  const normalized = email.trim().toLowerCase();
  if (!normalized) return false;

  for (const allowed of allowedEmails) {
    if (allowed.trim().toLowerCase() === normalized) return true;
  }

  return false;
}
