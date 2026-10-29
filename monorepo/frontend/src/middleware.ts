/**
 * The front door.
 *
 * One decision, made before any page renders: a visitor holding a session
 * does not see the landing page. The catalogue is where they were going.
 *
 * The decision used to live in the browser — the landing painted, its
 * plans section included, and a second later the account swapped it for
 * the catalogue. That flash is what this file exists to end. Middleware
 * runs before the route, so the redirect is the first thing that happens
 * and the landing page never renders at all; because the page itself
 * never reads the cookie, it also stays fully static.
 *
 * The cookie is read, not verified. It is the same bearer token the
 * account mirrors for the desk, and the catalogue verifies it against the
 * auth server on its own — so a stale cookie costs one hop to `/canale`,
 * which is the authority, and a missing one leaves the front door exactly
 * as it was. Nothing here can be fooled into granting anything, because
 * nothing here grants anything.
 */

import { NextResponse, type NextRequest } from "next/server";

/** The cookie the account mirrors its session into, for the server. */
const SESSION_COOKIE = "acum-session";

/** Where a visitor with a session goes instead of the front door. */
const SIGNED_IN_DESTINATION = "/canale";

export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname !== "/") return NextResponse.next();

  const session = request.cookies.get(SESSION_COOKIE)?.value;

  if (session) {
    const url = request.nextUrl.clone();
    url.pathname = SIGNED_IN_DESTINATION;
    // The address the visitor asked for is dropped with it: the catalogue
    // is the catalogue, and a stale `/` in the address would only send
    // them back here.
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // The front door and nothing else. Every other route keeps its existing
  // behaviour, and this matcher is what keeps the middleware off them.
  matcher: "/",
};
