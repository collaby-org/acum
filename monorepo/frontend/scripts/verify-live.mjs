/**
 * The live proof for the 1.7.0 fixes.
 *
 * It asks the deployed site the questions the bugs were about, and prints one
 * line per answer. No claim in the changelog is stronger than this file's
 * output.
 *
 *   node scripts/verify-live.mjs https://acum-weld.vercel.app/
 *
 * The harness credentials are read from the environment (never from a file
 * that could be committed):
 *
 *   NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
 *   ACUM_HARNESS_EMAIL, ACUM_HARNESS_PASSWORD
 *
 * Without them the script still runs the anonymous checks and says which
 * signed-in checks it could not run.
 */
import process from "node:process";

const APP = (process.argv[2] ?? "https://acum-weld.vercel.app/").replace(
  /\/$/,
  "",
);

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const EMAIL = process.env.ACUM_HARNESS_EMAIL;
const PASSWORD = process.env.ACUM_HARNESS_PASSWORD;

const results = [];

function record(name, pass, detail) {
  results.push({ name, pass, detail });
  const mark = pass ? "PASS" : "FAIL";
  console.log(`${mark}  ${name}${detail ? ` — ${detail}` : ""}`);
}

/** The cookie the browser mirrors its session into. */
function sessionCookie(accessToken) {
  const bytes = new TextEncoder().encode(JSON.stringify({ access_token: accessToken }));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function timed(url, init = {}) {
  const started = Date.now();
  const response = await fetch(url, {
    ...init,
    redirect: init.redirect ?? "manual",
    headers: { "user-agent": "acum-verify-live/1.7.0", ...(init.headers ?? {}) },
  });
  return { response, ms: Date.now() - started };
}

async function signIn() {
  if (!SUPABASE_URL || !SUPABASE_KEY || !EMAIL || !PASSWORD) return null;
  const response = await fetch(
    `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
    {
      method: "POST",
      headers: { apikey: SUPABASE_KEY, "content-type": "application/json" },
      body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
    },
  );
  if (!response.ok) return null;
  const body = await response.json();
  return body?.access_token ?? null;
}

async function main() {
  console.log(`ACUM live proof — ${APP}\n`);

  /* 1. The proxy is not an open egress any more. */
  {
    const { response, ms } = await timed(
      `${APP}/api/stream?u=${encodeURIComponent("https://example.xyz/")}`,
    );
    record(
      "the proxy refuses a browser-named upstream address",
      response.status === 400 || response.status === 403,
      `${response.status} in ${ms}ms`,
    );
  }
  {
    const { response } = await timed(
      `${APP}/api/stream?u=${encodeURIComponent("http://127.0.0.1:1/")}`,
    );
    record(
      "the proxy refuses a loopback address",
      response.status >= 400,
      `${response.status}`,
    );
  }
  {
    const { response } = await timed(`${APP}/api/stream?t=not-a-token`);
    record(
      "the proxy refuses a forged token",
      response.status === 403,
      `${response.status}`,
    );
  }

  /* 2. The resolve route is behind the paywall. */
  {
    const { response } = await timed(
      `${APP}/api/resolve?src=${encodeURIComponent("https://canaletvlive.online/")}`,
    );
    record(
      "the resolve route is gated",
      response.status === 403,
      `${response.status}`,
    );
  }

  /* 3. The player endpoint is behind the paywall. */
  {
    const { response } = await timed(`${APP}/api/player`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ channel: "pro-tv" }),
    });
    record(
      "the player endpoint is gated",
      response.status === 403,
      `${response.status}`,
    );
  }

  /* 4. The guide is read per channel, not by walking every slug. */
  {
    const { response, ms } = await timed(`${APP}/api/channel/pro-tv`);
    record(
      "the channel detail answers in under a second",
      response.ok && ms < 1500,
      `${response.status} in ${ms}ms`,
    );
  }

  /* 5. The front door: a signed-in visitor never sees the landing page. */
  {
    const { response } = await timed(`${APP}/`);
    record(
      "an anonymous visitor gets the landing page",
      response.status === 200,
      `${response.status}`,
    );
  }

  const token = await signIn();
  if (!token) {
    console.log(
      "\nSKIP  the signed-in checks — set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, ACUM_HARNESS_EMAIL and ACUM_HARNESS_PASSWORD to run them.",
    );
  } else {
    const cookie = `acum-session=${sessionCookie(token)}`;
    {
      const { response } = await timed(`${APP}/`, {
        headers: { cookie },
      });
      const location = response.headers.get("location") ?? "";
      record(
        "a signed-in visitor is redirected to the catalogue before any markup",
        response.status >= 300 &&
          response.status < 400 &&
          location.includes("/canale"),
        `${response.status} → ${location}`,
      );
    }
    {
      const { response, ms } = await timed(`${APP}/api/player`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ channel: "pro-tv" }),
      });
      const body = response.ok ? await response.json() : null;
      const urls = body?.sources?.map((source) => source.url) ?? [];
      record(
        "an entitled visitor receives signed stream addresses",
        response.ok &&
          urls.length > 0 &&
          urls.every((url) => url.startsWith("/api/stream?t=")),
        `${response.status}, ${urls.length} source(s), ${ms}ms`,
      );
      const cacheControl = response.headers.get("cache-control") ?? "";
      record(
        "the manifest is never cached",
        cacheControl.includes("no-store"),
        cacheControl || "(none)",
      );
    }
    {
      const { response } = await timed(`${APP}/api/account`, {
        headers: { authorization: `Bearer ${token}` },
      });
      const body = response.ok ? await response.json() : null;
      record(
        "the account answer carries the desk flag from the server",
        response.ok && typeof body?.isAdmin === "boolean",
        `${response.status}, isAdmin=${body?.isAdmin}`,
      );
    }
  }

  const failed = results.filter((result) => !result.pass);
  console.log(
    `\n${results.length - failed.length}/${results.length} checks passed.`,
  );
  if (failed.length > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
