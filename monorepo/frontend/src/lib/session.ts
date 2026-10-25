/**
 * The catalogue gate.
 *
 * The catalogue belongs to an account: a visitor who is not signed in is
 * sent to the accounts page rather than shown the product and then refused
 * by the player. The check runs on the server, on every `/canale*` route.
 *
 * The session is verified against the auth server, never trusted from the
 * cookie alone — a cookie is something the visitor can write. `readSession`
 * already does that; this module only gives the catalogue one place to say
 * where a signed-out visitor goes.
 */
import { redirect } from "next/navigation";
import { readSession } from "@/lib/admin";

/** Redirect to `/conturi` unless a verified session is present. */
export async function requireSignedIn(): Promise<void> {
  const session = await readSession();
  if (!session) redirect("/conturi");
}
