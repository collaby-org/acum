/**
 * The browser's Supabase client.
 *
 * The client is built lazily and kept in a module variable: the module is
 * imported by client components, but the server renders those components too,
 * and `createClient` reaches for `window` to attach its storage adapter. A
 * module that touched `window` on import would break the server render, so
 * nothing is built until a browser actually asks for it.
 *
 * The keys are the project's publishable ones. They are safe to ship — the
 * row level policies are what keep the data apart — and they are the only
 * Supabase credentials that ever reach the browser.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/** The project's address. */
export const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  "https://xmmftuxbvzpdbnsypbbz.supabase.co";

/** The project's publishable key. */
export const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "sb_publishable_jJgnvA1G4a_oE6SCrJS7hQ_pPTrYOeB";

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

  cached = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });

  return cached;
}
