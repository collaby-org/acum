/**
 * The Supabase project, read from the environment — and nothing else.
 *
 * There is no fallback baked into this file: the publishable key and the
 * project URL live in `.env` (gitignored; the committed template is
 * `.env.example`) and in Vercel's Environment Variables. The RLS rules in
 * `supabase/schema.sql` are what actually keep the data closed.
 *
 * Node does not read `.env` on its own, so a tiny loader runs first — real
 * environment variables always win over the file. Every harness script
 * reaches this module through `harness-account.mjs` or `harness-signin.mjs`,
 * so one loader covers them all.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

function loadDotEnv() {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  let raw;
  try {
    raw = readFileSync(resolve(root, ".env"), "utf8");
  } catch {
    return; /* no file — the real environment must carry the values */
  }
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadDotEnv();

/** The project's URL. */
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

/** The publishable (client-side) key. */
export const SUPABASE_PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/** The harness account, the browser checks sign in with. */
export const HARNESS_EMAIL = process.env.ACUM_HARNESS_EMAIL ?? "";
export const HARNESS_PASSWORD = process.env.ACUM_HARNESS_PASSWORD ?? "";

if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  throw new Error(
    "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are not set. " +
      "Copy .env.example to .env and fill it in.",
  );
}

/** The auth session's key in browser storage. */
export const SUPABASE_SESSION_KEY = `sb-${new URL(SUPABASE_URL).hostname.split(".")[0]}-auth-token`;
