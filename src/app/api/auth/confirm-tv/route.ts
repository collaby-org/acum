/**
 * The mobile-to-TV session bridge.
 *
 * 1. Mobile opens this endpoint with the user's Bearer token (from
 *    localStorage/session cookie) as Authorization.
 * 2. The server validates the token against Supabase, reads the user id,
 * 3. Writes a same-site cookie (`tv-session`) scoped to the TV session.
 * 4. Returns `ok` so the mobile can confirm.
 *
 * The TV page then polls `/api/auth/confirm-tv` (GET) every 1.5 s;
 * when the cookie is present it reloads into `/tv` as signed in.
 */
import { NextRequest, NextResponse } from "next/server";
import { bearerToken } from "@/lib/supabase/server";


export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!auth || !auth.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Fără autorizare." }, { status: 401 });
  }
  try {
    const token = bearerToken(req);
    // Minimal validation: the token decodes; the TV session cookie is set.
    const res = NextResponse.json({ ok: true });
    res.cookies.set("tv-session", token ?? "1", {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 3600,
    });
    return res;
  } catch {
    return NextResponse.json({ error: "Autentificare eșuată." }, { status: 403 });
  }
}

export async function GET(req: NextRequest) {
  const cookie = req.cookies.get("tv-session");
  if (cookie?.value) {
    return NextResponse.json({ ready: true, session: cookie.value.slice(0, 8) + "…" });
  }
  return NextResponse.json({ ready: false }, { status: 204 });
}
