/**
 * The heartbeat of a stream.
 *
 * `POST { session }` — the player is still on screen. The registry keeps one
 * row per device and frees the seat of a row nobody has touched for ninety
 * seconds, so this is the difference between "a tab was closed" and "a seat
 * is held forever".
 *
 * `DELETE { session }` — the player was closed, or moved to another channel.
 * The seat is freed the moment the viewer lets go of it.
 *
 * Both are written with the visitor's own token, so the row level policies
 * decide what may be touched. A session that is not the caller's is simply
 * not found.
 */
import { bearerToken, readUser } from "@/lib/supabase/server";
import { endStreamSession, touchStreamSession } from "@/lib/stream-sessions";


type Body = { session?: unknown };

/** The caller, or null. */
async function caller(request: Request): Promise<{ token: string; userId: string } | null> {
  const token = bearerToken(request);
  if (!token) return null;
  try {
    const user = await readUser(token);
    return user ? { token, userId: user.id } : null;
  } catch {
    return null;
  }
}

async function sessionOf(request: Request): Promise<string | null> {
  try {
    const body = (await request.json()) as Body;
    return typeof body.session === "string" && body.session.length <= 64
      ? body.session
      : null;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const who = await caller(request);
  if (!who) return new Response(null, { status: 401 });

  const sessionId = await sessionOf(request);
  if (!sessionId) return new Response(null, { status: 400 });

  await touchStreamSession({ ...who, sessionId });
  // A heartbeat is never worth an error: a registry that is behind must not
  // take the picture down with it.
  return new Response(null, { status: 204 });
}

export async function DELETE(request: Request) {
  const who = await caller(request);
  if (!who) return new Response(null, { status: 401 });

  const sessionId = await sessionOf(request);
  if (!sessionId) return new Response(null, { status: 400 });

  await endStreamSession({ ...who, sessionId });
  return new Response(null, { status: 204 });
}
