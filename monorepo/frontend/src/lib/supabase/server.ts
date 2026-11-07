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

/**
 * This module owns the service role key. A browser bundle must never load it,
 * so the module refuses to initialise outside the server. The project does
 * not currently depend on the `server-only` package; this explicit guard is
 * the equivalent protection until that dependency can be added safely.
 */
if (typeof window !== "undefined") {
  throw new Error(
    "Clientul Supabase de server nu poate fi importat în browser. Cheile de server nu ajung niciodată în browser.",
  );
}

/** The service role key. Server-only; never sent to the browser. */
export const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

/** True when the desk can be reached — the service role key is present. */
export function hasServiceRole(): boolean {
  return Boolean(SERVICE_ROLE_KEY);
}

/**
 * True when the public desk can be reached — the anon key is present.
 *
 * This is the one the reviews need, and it is the one that is always
 * present in a real deployment: the same key ships in the browser, so a
 * project that can sign anybody in can read the reviews as well.
 */
export function hasPublicConfig(): boolean {
  return Boolean(SUPABASE_URL) && Boolean(SUPABASE_ANON_KEY);
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
 * A client with no session behind it: everything the anon key may read.
 *
 * This is the read the whole world gets — the reviews and their counts,
 * which is exactly what the row level policies hand to `anon` and nobody
 * else. Writing never goes through here: a write needs a session, and a
 * session is a token.
 */
export function getPublicClient(): SupabaseClient {
  assertServer("getPublicClient()");

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL și NEXT_PUBLIC_SUPABASE_ANON_KEY nu sunt setate. Operațiunile publice (recenzii) au nevoie de ele.",
    );
  }

  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
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

/** The result of checking an access token against the auth server. */
export type UserVerification =
  | { status: "authenticated"; user: { id: string; email: string | null } }
  | { status: "signed-out" }
  | { status: "unavailable" };

/**
 * Check an access token and say what happened.
 *
 * A rejected token and an auth server that could not answer are different
 * facts. The first means the visitor is signed out; the second means nobody
 * knows yet. Callers that need that distinction use this helper.
 *
 * The check is bounded: an auth server that accepts the connection and then
 * goes quiet cannot hold a page open forever.
 */
export async function verifyUser(
  accessToken: string,
  timeoutMs = 2_500,
): Promise<UserVerification> {
  assertServer("verifyUser()");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  let body: {
    id?: unknown;
    email?: unknown;
  };
  try {
    response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
      signal: controller.signal,
    });

    if (response.status === 400 || response.status === 401 || response.status === 403) {
      return { status: "signed-out" };
    }
    if (!response.ok) return { status: "unavailable" };

    body = (await response.json()) as {
      id?: unknown;
      email?: unknown;
    };
  } catch {
    // The auth server is unreachable, timed out or answered with a
    // malformed body. None of those proves that the visitor is signed out.
    return { status: "unavailable" };
  } finally {
    clearTimeout(timeout);
  }

  if (typeof body.id !== "string" || body.id.length === 0) {
    return { status: "unavailable" };
  }

  return {
    status: "authenticated",
    user: {
      id: body.id,
      email: typeof body.email === "string" ? body.email : null,
    },
  };
}

/**
 * The visitor behind a request, read from the `Authorization` header.
 *
 * The token is checked against Supabase, never decoded and believed: a
 * forged token is worth nothing here. The exported contract stays the same
 * for callers that only need to know whether a user exists.
 */
export async function readUser(
  accessToken: string,
): Promise<{ id: string; email: string | null } | null> {
  const result = await verifyUser(accessToken);
  return result.status === "authenticated" ? result.user : null;
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
