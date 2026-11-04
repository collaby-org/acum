/**
 * The front door.
 *
 * One decision, made before any page renders: a visitor holding a live
 * session does not see the landing page. The catalogue is where they were
 * going.
 *
 * The decision used to live in the browser — the landing painted, its
 * plans section included, and a second later the account swapped it for
 * the catalogue. That flash is what this file exists to end. The proxy
 * runs before the route, so the redirect is the first thing that happens
 * and the landing page never renders at all; because the page itself
 * never reads the cookie, it also stays fully static.
 *
 * What the cookie is checked for is the session, not its mere presence. A
 * browser that was closed for longer than the access token's lifetime
 * comes back with a cookie whose token has expired, and redirecting on the
 * presence of that cookie sent the visitor to the catalogue, the
 * catalogue refused the expired token, and the visitor was thrown back to
 * the accounts page — again and again, because every bounce went through
 * this same door.
 *
 * So the token is read, and only a token that is still good sends the
 * visitor to the catalogue. An expired one is cleared, and the page stays
 * the landing page: the browser refreshes its own session (it owns the
 * refresh token), writes the new access token into the cookie, and the
 * front door's client half — `SessionGate` — sends the visitor on. The
 * server never renews with the refresh token: the auth server rotates it,
 * and a token used from two places can revoke the whole session.
 *
 * The catalogue still verifies the token against the auth server on its
 * own. Nothing here grants anything: the worst a forged cookie buys is a
 * hop to the catalogue, which is the authority and refuses it.
 */

import { NextResponse, type NextRequest } from "next/server";
import {
  decodeSessionCookie,
  SESSION_COOKIE,
  tokenIsFresh,
} from "@/lib/session-token";

/** Where a visitor with a session goes instead of the front door. */
const SIGNED_IN_DESTINATION = "/canale";

/** The catalogue, with the address the visitor asked for dropped. */
function catalogueRedirect(request: NextRequest): NextResponse {
  const url = request.nextUrl.clone();
  url.pathname = SIGNED_IN_DESTINATION;
  // The address the visitor asked for is dropped with it: the catalogue is
  // the catalogue, and a stale `/` in the address would only send them
  // back here.
  url.search = "";
  return NextResponse.redirect(url);
}

/**
 * The front door itself.
 *
 * Next.js 16 renamed the `middleware` file convention to `proxy`; this is
 * that file. The export below is the one the framework looks for.
 */
export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname !== "/") return NextResponse.next();

  const mirrored = decodeSessionCookie(
    request.cookies.get(SESSION_COOKIE)?.value,
  );
  if (!mirrored) return NextResponse.next();

  if (tokenIsFresh(mirrored.access_token)) {
    return catalogueRedirect(request);
  }

  // The access token is gone: the cookie is cleared, and the front door
  // stays the landing page. The browser refreshes its own session, writes
  // the new token into the cookie, and the page's client half sends the
  // visitor to the catalogue — once, and only once.
  const response = NextResponse.next();
  response.cookies.delete(SESSION_COOKIE);
  return response;
}

export const config = {
  // The front door and nothing else. Every other route keeps its existing
  // behaviour, and this matcher is what keeps the proxy off them.
  matcher: "/",
};
