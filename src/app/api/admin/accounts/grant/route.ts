/**
 * Granting access by hand.
 *
 *   POST /api/admin/accounts/grant
 *
 *   { userId, plan, planUntil, bypass, note }
 *
 * The plan, the end date and the bypass are the desk's business: they are
 * written with the service role, because a signed-in visitor cannot change
 * them on their own row. Every grant leaves a line in the account's note —
 * who did it, when, what changed and why — and that line is what the
 * account list shows back.
 */
import { deskGuard, grantAccess, isPlan, type Plan } from "@/lib/admin";


const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  const guard = await deskGuard(request);
  if (!guard.ok) return guard.response;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json(
      { error: "Cererea nu a putut fi citită." },
      { status: 400, headers: { "cache-control": "no-store" } },
    );
  }

  const userId = typeof body.userId === "string" ? body.userId.trim() : "";
  const plan = body.plan;
  const planUntil = body.planUntil;
  const bypass = body.bypass === true;
  const note = typeof body.note === "string" ? body.note.trim().slice(0, 400) : "";

  if (!UUID.test(userId)) {
    return Response.json(
      { error: "Contul nu a fost identificat." },
      { status: 400, headers: { "cache-control": "no-store" } },
    );
  }
  if (!isPlan(plan)) {
    return Response.json(
      { error: "Planul nu este cunoscut." },
      { status: 400, headers: { "cache-control": "no-store" } },
    );
  }
  if (planUntil !== null && planUntil !== undefined && planUntil !== "") {
    if (Number.isNaN(new Date(String(planUntil)).getTime())) {
      return Response.json(
        { error: "Data de sfârșit nu este validă." },
        { status: 400, headers: { "cache-control": "no-store" } },
      );
    }
  }

  try {
    const account = await grantAccess({
      userId,
      plan: plan as Plan,
      planUntil:
        planUntil === null || planUntil === undefined || planUntil === ""
          ? null
          : new Date(String(planUntil)).toISOString(),
      bypass,
      note,
      by: guard.session.email ?? guard.session.userId,
    });

    return Response.json(
      { account },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Contul nu a putut fi actualizat.";
    return Response.json(
      { error: message },
      { status: 400, headers: { "cache-control": "no-store" } },
    );
  }
}
