/**
 * The messages the contact form wrote.
 *
 *   GET /api/admin/messages?state=inbox|unread|archived
 *
 * They are read with the service role: the table has an insert policy for
 * anybody and a select policy that nobody but the desk satisfies.
 */
import { deskGuard, listMessages, type MessageState } from "@/lib/admin";


const STATES: readonly MessageState[] = ["inbox", "unread", "archived"];

export async function GET(request: Request) {
  const guard = await deskGuard(request);
  if (!guard.ok) return guard.response;

  const params = new URL(request.url).searchParams;
  const raw = params.get("state") ?? "inbox";
  const state = (STATES as readonly string[]).includes(raw)
    ? (raw as MessageState)
    : "inbox";

  const messages = await listMessages({ state, limit: 100 });

  return Response.json(
    { messages },
    { headers: { "cache-control": "no-store" } },
  );
}
