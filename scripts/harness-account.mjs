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
const URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  "https://xmmftuxbvzpdbnsypbbz.supabase.co";
const KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "sb_publishable_jJgnvA1G4a_oE6SCrJS7hQ_pPTrYOeB";

const EMAIL = process.env.ACUM_HARNESS_EMAIL ?? "harness@acum.test";
const PASSWORD = process.env.ACUM_HARNESS_PASSWORD ?? "acum-harness-2026";

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
