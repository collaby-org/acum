/**
 * The household device.
 *
 * `POST { device }` — confirm that this is the screen the house plays on.
 *
 * A household plan is bound to one device on its first playback. A phone
 * bought last week, or a laptop opened on holiday, is then asked to confirm
 * before it plays — the way the streaming services ask. Confirming is this
 * route: the account says yes, the device is bound, and every other live
 * stream of the account is closed, because the point of a house is that
 * there is one.
 *
 * Nothing here is believed from the browser except the identifier itself,
 * which is opaque and carries nothing about the person using it.
 */
import { bearerToken, readUser } from "@/lib/supabase/server";
import { rebindHousehold } from "@/lib/stream-sessions";


const DEVICE = /^[A-Za-z0-9._-]{8,128}$/;

export async function POST(request: Request) {
  const token = bearerToken(request);
  if (!token) {
    return Response.json(
      { error: "Trebuie să fii conectat." },
      { status: 401, headers: { "cache-control": "no-store" } },
    );
  }

  let userId: string | null = null;
  try {
    const user = await readUser(token);
    userId = user?.id ?? null;
  } catch {
    userId = null;
  }

  if (!userId) {
    return Response.json(
      { error: "Sesiunea a expirat. Conectează-te din nou." },
      { status: 401, headers: { "cache-control": "no-store" } },
    );
  }

  let device = "";
  try {
    const body = (await request.json()) as { device?: unknown };
    device = typeof body.device === "string" ? body.device.trim() : "";
  } catch {
    device = "";
  }

  if (!DEVICE.test(device)) {
    return Response.json(
      { error: "Dispozitivul nu a putut fi citit." },
      { status: 400, headers: { "cache-control": "no-store" } },
    );
  }

  const bound = await rebindHousehold({ token, userId, device });
  if (!bound) {
    return Response.json(
      {
        error:
          "Casa nu a putut fi actualizată. Planul tău nu are casă, sau registrul nu este încă activ.",
      },
      { status: 409, headers: { "cache-control": "no-store" } },
    );
  }

  return Response.json(
    { ok: true },
    { headers: { "cache-control": "no-store" } },
  );
}
