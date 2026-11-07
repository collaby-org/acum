/**
 * The front door.
 *
 * One decision, made before any page renders: a visitor who has been here
 * before does not see the landing page — the catalogue is where they were
 * going.
 *
 * The decision used to live in the browser — the landing painted, its
 * plans section included, and a second later the account swapped it for
 * the catalogue. That flash is what this file exists to end. The proxy
 * runs before the route, so the redirect is the first thing that happens
 * and the landing page never renders at all; because the page itself
 * never reads the cookie, it also stays fully static.
 *
 * What the cookie is checked for is the presence of a session, not its
 * freshness. An access token expires after an hour, and a browser that
 * was closed overnight comes back with a cookie whose token is spent —
 * while the refresh token, which the browser owns, is still good. The
 * visitor is still signed in; the cookie is just old. Sending that
 * visitor to the landing page (or, worse, to the accounts page) would be
 * wrong, so the cookie's mere presence is enough to send them to the
 * catalogue.
 *
 * Nothing is granted here. The catalogue is the public face of the
 * product — names, artwork, the guide, the audience — and the way in
 * lives in the player, where the picture is: `/api/player` checks the
 * account, the plan and the allowance, and refuses what is not due.
 * The worst a forged cookie buys is a hop to a page that is public
 * anyway.
 *
 * And there is one more thing this file rules out: the accounts page.
 * `/conturi` is where a visitor goes when they ask for something that
 * needs an account — opening a channel they have no plan for. It is
 * never where a visitor is *sent* while the app is starting. The
 * catalogue pages do not gate on the session either, so a network blip
 * at the auth server can never bounce anyone to `/conturi` on the way
 * in.
 */

import { NextResponse, type NextRequest } from "next/server";
import {
  decodeSessionCookie,
  SESSION_COOKIE,
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

  return catalogueRedirect(request);
}

export const config = {
  // The front door and nothing else. Every other route keeps its existing
  // behaviour, and this matcher is what keeps the proxy off them.
  matcher: "/",
};
