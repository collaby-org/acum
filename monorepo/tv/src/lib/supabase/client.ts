/**
 * The browser's Supabase client.
 *
 * The client is built lazily and kept in a module variable: the module is
 * imported by client components, but the server renders those components too,
 * and `createClient` reaches for `window` to attach its storage adapter. A
 * module that touched `window` on import would break the server render, so
 * nothing is built until a browser actually asks for it.
 *
 * The keys come from the environment and nowhere else — there is no
 * fallback baked into the bundle. `NEXT_PUBLIC_*` values are inlined at
 * build time, so on Vercel they must be set before the build runs. The
 * publishable key is safe to ship: the row level policies are what keep
 * the data apart, and it is the only Supabase credential that ever reaches
 * the browser.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/** The project's address. */
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

/** The project's publishable key. */
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/**
 * The configuration, or a thrown error that says exactly what is missing.
 *
 * Every path into Supabase — the browser client, the visitor's server
 * client, the auth calls — goes through here, so a deployment without the
 * environment fails with one readable sentence instead of an opaque
 * `createClient` crash or a fetch to "undefined".
 */
export function requireSupabaseConfig(): { url: string; key: string } {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL și NEXT_PUBLIC_SUPABASE_ANON_KEY nu sunt setate. " +
        "Local: copiază .env.example în .env și completează-l. " +
        "Pe Vercel: Settings → Environment Variables, înainte de build.",
    );
  }
  return { url: SUPABASE_URL, key: SUPABASE_ANON_KEY };
}

let cached: SupabaseClient | null = null;

/**
 * The browser client.
 *
 * One client per tab: Supabase keeps the session in `localStorage` and
 * refreshes the token on its own, and a second client would fight the first
 * one over the same storage key.
 */
export function getSupabaseClient(): SupabaseClient {
  if (cached) return cached;

  if (typeof window === "undefined") {
    throw new Error(
      "getSupabaseClient() a fost apelat pe server. Clientul de browser se construiește la cerere, în browser.",
    );
  }

  const { url, key } = requireSupabaseConfig();

  cached = createClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });

  return cached;
}
