/**
 * One message: marked as read, or archived.
 *
 *   POST /api/admin/messages/<id>  { read?, archived? }
 */
import { deskGuard, setMessageState } from "@/lib/admin";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const guard = await deskGuard(request);
  if (!guard.ok) return guard.response;

  const { id } = await context.params;
  if (!UUID.test(id ?? "")) {
    return Response.json(
      { error: "Mesajul nu a fost identificat." },
      { status: 400, headers: { "cache-control": "no-store" } },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }

  const patch: { read?: boolean; archived?: boolean } = {};
  if (typeof body.read === "boolean") patch.read = body.read;
  if (typeof body.archived === "boolean") patch.archived = body.archived;

  if (!Object.keys(patch).length) {
    return Response.json(
      { error: "Nimic de schimbat." },
      { status: 400, headers: { "cache-control": "no-store" } },
    );
  }

  const message = await setMessageState(id, patch);
  if (!message) {
    return Response.json(
      { error: "Mesajul nu a fost găsit." },
      { status: 404, headers: { "cache-control": "no-store" } },
    );
  }

  return Response.json(
    { message },
    { headers: { "cache-control": "no-store" } },
  );
}
