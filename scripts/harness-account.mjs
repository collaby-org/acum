/**
 * The harness account.
 *
 * The product is account-gated: a stream address is only minted for an
 * account that may watch. The verification harnesses therefore have to be
 * signed in, or they would be measuring a wall.
 *
 * The account is a real one in the real project — it is created by hand, it
 * is on the free plan, and it counts its own two hours like anybody else.
 * The credentials come from the environment, so nothing secret is written
 * down here.
 */
import { HARNESS_EMAIL, HARNESS_PASSWORD, SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./supabase-config.mjs";

const URL = SUPABASE_URL;
const KEY = SUPABASE_PUBLISHABLE_KEY;

const EMAIL = HARNESS_EMAIL;
const PASSWORD = HARNESS_PASSWORD;

if (!EMAIL || !PASSWORD) {
  throw new Error(
    "ACUM_HARNESS_EMAIL and ACUM_HARNESS_PASSWORD are not set. " +
      "Copy .env.example to .env and fill in the harness account.",
  );
}

let cached = null;

/** The session token of the harness account. */
export async function harnessToken() {
  if (cached) return cached;
  const response = await fetch(`${URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { "content-type": "application/json", apikey: KEY },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  if (!response.ok) {
    throw new Error(
      `the harness could not sign in (${response.status}): ${await response.text()}`,
    );
  }
  const payload = await response.json();
  cached = payload.access_token;
  return cached;
}

/** The header the gated routes expect. */
export async function harnessAuth() {
  return { authorization: `Bearer ${await harnessToken()}` };
}
