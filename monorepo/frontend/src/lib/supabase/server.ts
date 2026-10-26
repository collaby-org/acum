/**
 * The server's Supabase clients.
 *
 * Two of them, and the difference matters:
 *
 *   - `getServiceClient()` holds the service role key. It reads and writes
 *     everything — the desk, the subscriptions, the plans. It must never
 *     reach the browser, so the module refuses to build a client when it
 *     finds a `window`, and it throws loudly when the key is missing rather
 *     than quietly falling back to something weaker.
 *   - `getUserClient(token)` holds the visitor's own token. The row level
 *     policies apply to it exactly as they do in the browser, so the account
 *     routes can read and write a visitor's own rows without the service
 *     role — and without the visitor ever being trusted.
 *
 * The service role key is read from `SUPABASE_SERVICE_ROLE_KEY` and is
 * server-only. Nothing in this module is imported by a client component.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/supabase/client";

/** The service role key. Server-only; never sent to the browser. */
export const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

/** True when the desk can be reached — the service role key is present. */
export function hasServiceRole(): boolean {
  return Boolean(SERVICE_ROLE_KEY);
}

/**
 * Refuse to run a server module in the browser.
 *
 * The service role key bypasses every row level policy. A bundle that carried
 * it would hand the whole database to whoever loaded the page, so the guard
 * is a thrown error rather than a warning.
 */
function assertServer(what: string): void {
  if (typeof window !== "undefined") {
    throw new Error(
      `${what} a fost apelat în browser. Cheile de server nu ajung niciodată în browser.`,
    );
  }
}

/**
 * The service role client.
 *
 * Throws when `SUPABASE_SERVICE_ROLE_KEY` is not set: a desk that silently
 * does nothing is worse than a desk that says it is not configured.
 */
export function getServiceClient(): SupabaseClient {
  assertServer("getServiceClient()");

  if (!SERVICE_ROLE_KEY) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY nu este setat. Operațiunile de server (planuri, abonamente) au nevoie de el.",
    );
  }

  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * A client acting as the signed-in visitor.
 *
 * The token goes into the `Authorization` header, so every query runs under
 * the visitor's own policies: they can read their profile and their watch
 * sessions, and nothing else.
 */
export function getUserClient(accessToken: string): SupabaseClient {
  assertServer("getUserClient()");

  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}

/**
 * The visitor behind a request, read from the `Authorization` header.
 *
 * The token is checked against Supabase, never decoded and believed: a
 * forged token is worth nothing here.
 */
export async function readUser(
  accessToken: string,
): Promise<{ id: string; email: string | null } | null> {
  assertServer("readUser()");

  let response: Response;
  try {
    response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
    });
  } catch {
    // The auth server is unreachable. A visitor is not signed in for as
    // long as that lasts — the caller decides what a blip means for this
    // route, but the fetch itself must not crash the page.
    return null;
  }

  if (!response.ok) return null;

  const body = (await response.json()) as {
    id?: unknown;
    email?: unknown;
  };

  if (typeof body.id !== "string" || body.id.length === 0) return null;

  return {
    id: body.id,
    email: typeof body.email === "string" ? body.email : null,
  };
}

/**
 * The bearer token of a request, when it carries one.
 *
 * The browser sends the session token Supabase gave it; nothing else is
 * accepted.
 */
export function bearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match ? match[1].trim() : null;
}
