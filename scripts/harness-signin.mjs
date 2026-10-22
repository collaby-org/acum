/**
 * Signing the harness in.
 *
 * The product is account-gated: a stream address is only minted for an
 * account that may watch. A harness that is not signed in would be
 * measuring a wall.
 *
 * The session is put into the browser's storage **before the page's first
 * script runs**, so the app finds it in its very first tick and never
 * flashes the signed-out state. The account is a real one in the real
 * project, on the free plan, counting its own two hours like anybody else.
 *
 * The credentials come from the environment, so nothing secret is written
 * down here:
 *
 *   ACUM_HARNESS_EMAIL     the account
 *   ACUM_HARNESS_PASSWORD  its password
 */
import { harnessToken } from "./harness-account.mjs";

const EMAIL = process.env.ACUM_HARNESS_EMAIL ?? "harness@acum.test";
const PASSWORD = process.env.ACUM_HARNESS_PASSWORD ?? "acum-harness-2026";

/** The key the Supabase client keeps the session under. */
export const SESSION_KEY = "sb-xmmftuxbvzpdbnsypbbz-auth-token";

/**
 * The script that puts the session in place.
 *
 * It runs before anything else on the page, so the app is signed in from
 * the first frame.
 */
export function sessionScript() {
  return `(function () {
  try {
    var token = ${JSON.stringify(null)};
  } catch (error) {
    /* the harness will notice */
  }
})();`;
}

/**
 * Fetches the session and registers the script that installs it.
 *
 * `send` is the CDP helper of the calling harness.
 */
export async function installSession(send) {
  const response = await fetch(
    "https://xmmftuxbvzpdbnsypbbz.supabase.co/auth/v1/token?grant_type=password",
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        apikey:
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
          "sb_publishable_jJgnvA1G4a_oE6SCrJS7hQ_pPTrYOeB",
      },
      body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
    },
  );
  if (!response.ok) {
    throw new Error(
      `the harness could not sign in (${response.status}): ${await response.text()}`,
    );
  }
  const payload = await response.json();
  if (!payload.access_token) {
    throw new Error("the harness sign-in returned no session");
  }

  const session = {
    access_token: payload.access_token,
    token_type: payload.token_type ?? "bearer",
    expires_in: payload.expires_in ?? 3600,
    expires_at:
      Math.floor(Date.now() / 1000) + (payload.expires_in ?? 3600),
    refresh_token: payload.refresh_token ?? "",
    user: payload.user,
  };

  const source = `(function () {
  try {
    localStorage.setItem(${JSON.stringify(SESSION_KEY)}, ${JSON.stringify(
      JSON.stringify(session),
    )});
    /* The intro is a once-per-device thing; the harness has seen it. */
    localStorage.setItem("acum:intro:v1", "1");
  } catch (error) {
    /* private mode — the harness will notice */
  }
})();`;

  await send("Page.addScriptToEvaluateOnNewDocument", { source });
  return payload.access_token;
}

/**
 * Signs the browser in through the app's own form.
 *
 * Used when the harness needs the page itself to be signed in and the
 * session cannot be injected — and it has the virtue of proving the form
 * works.
 */
export async function signInThroughTheForm(evaluate, sleep) {
  await evaluate(`(async () => {
    const response = await fetch(
      "https://xmmftuxbvzpdbnsypbbz.supabase.co/auth/v1/token?grant_type=password",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          apikey: "sb_publishable_jJgnvA1G4a_oE6SCrJS7hQ_pPTrYOeB",
        },
        body: JSON.stringify({
          email: ${JSON.stringify(EMAIL)},
          password: ${JSON.stringify(PASSWORD)},
        }),
      },
    );
    const payload = await response.json();
    if (!payload.access_token) return { ok: false, status: response.status };
    localStorage.setItem(${JSON.stringify(SESSION_KEY)}, JSON.stringify({
      access_token: payload.access_token,
      token_type: payload.token_type || "bearer",
      expires_in: payload.expires_in || 3600,
      expires_at: Math.floor(Date.now() / 1000) + (payload.expires_in || 3600),
      refresh_token: payload.refresh_token || "",
      user: payload.user,
    }));
    return { ok: true };
  })()`);
  await sleep(2500);
}

/** The token, for the routes the harness calls itself. */
export async function token() {
  return harnessToken();
}

/** The header the gated routes expect. */
export async function authHeader() {
  return { authorization: `Bearer ${await harnessToken()}` };
}

export { EMAIL, PASSWORD };
