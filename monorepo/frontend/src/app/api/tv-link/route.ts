/**
 * The TV link bridge.
 *
 *   POST  /api/tv-link?issue   — the television asks for a code
 *   GET   /api/tv-link?code=…  — the television polls for the session
 *   POST  /api/tv-link?confirm — the phone hands its session over
 *
 * The bridge is the only thing that knows a code and a session belong to
 * the same television. Everything it writes is written with the service
 * role, because that is the only thing that can read these rows without
 * a policy that would let one visitor read another's session.
 *
 * Nothing here is public: a code is issued to whoever asks, but only the
 * phone that holds a session can turn one into a session.
 */

import { readUser } from "@/lib/supabase/server";
import {
  callerToken,
  confirmTvCode,
  consumeTvCode,
  issueTvCode,
  isTvCode,
  readTvCode,
  tvBridgeReady,
  tvSessionFor,
} from "@/lib/tv-link";

/** The answer the bridge gives when it cannot be used at all. */
const NO_SERVICE = {
  error: "bridge-unavailable",
  message:
    "Legătura cu televizorul nu este configurată. Cheia de service lipsește.",
};

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");

  if (!isTvCode(code)) {
    return json({ error: "bad-code", message: "Codul nu este unul valid." }, 400);
  }

  if (!tvBridgeReady()) return json(NO_SERVICE, 503);

  const session = await tvSessionFor(code);
  if (!session) {
    const record = await readTvCode(code);
    if (record?.status === "expired") {
      return json({ status: "expired" }, 200);
    }
    return json({ status: "pending" }, 200);
  }

  // The session is handed over once; the row is spent the moment it is
  // taken, so a second television with the same code gets nothing.
  await consumeTvCode(code);
  return json({ status: "confirmed", access_token: session.accessToken }, 200);
}

export async function POST(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const intent = url.searchParams.get("issue") ? "issue"
    : url.searchParams.get("confirm") ? "confirm"
    : null;

  if (!intent) {
    return json(
      { error: "bad-intent", message: "Lipsește intenția: issue sau confirm." },
      400,
    );
  }

  if (!tvBridgeReady()) return json(NO_SERVICE, 503);

  if (intent === "issue") {
    // The device asks for a code. Its id is whatever it says it is — the
    // code is the proof, not the id, so the id is only echoed back.
    let tvId: string | null = null;
    try {
      const body = (await request.json()) as { tv_id?: unknown };
      if (typeof body.tv_id === "string" && body.tv_id.trim()) {
        tvId = body.tv_id.trim().slice(0, 64);
      }
    } catch {
      /* A device that sends no body still gets a code. */
    }

    const record = await issueTvCode(tvId);
    return json(
      {
        code: record.code,
        tv_id: record.tv_id,
        expires_at: record.expires_at,
        expires_in: Math.max(
          0,
          Math.round(
            (new Date(record.expires_at).getTime() - Date.now()) / 1000,
          ),
        ),
      },
      201,
    );
  }

  // The phone confirms. Without a session there is nothing to hand over.
  const token = await callerToken(request);
  if (!token) {
    return json(
      { error: "no-session", message: "Conectează-te întâi pe telefon." },
      401,
    );
  }

  let code: string | null = null;
  try {
    const body = (await request.json()) as { code?: unknown };
    if (typeof body.code === "string") code = body.code;
  } catch {
    /* fall through to the check below */
  }

  if (!isTvCode(code)) {
    return json({ error: "bad-code", message: "Codul nu este unul valid." }, 400);
  }

  // The token is checked against the auth server before it is believed:
  // a token the visitor wrote themselves is not a session.
  const user = await readUser(token);
  if (!user) {
    return json(
      { error: "bad-session", message: "Sesiunea nu mai este valabilă." },
      401,
    );
  }

  const result = await confirmTvCode(code, token);
  if (!result.ok) {
    const messages = {
      unknown: "Codul nu există.",
      expired: "Codul a expirat. Cere unul nou pe televizor.",
      used: "Codul este deja folosit.",
    } as const;
    return json({ error: result.reason, message: messages[result.reason] }, 409);
  }

  return json({ ok: true }, 200);
}

/** The bridge never reveals whether the service key is set — only that it works. */
/*
 * No route segment config: this app runs with `cacheComponents` on, which
 * refuses `dynamic` and `runtime` exports outright. The handlers are
 * already per-request — they read cookies, headers and the database, and
 * the response is never cached — so nothing here needed either.
 */
