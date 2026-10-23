/**
 * The accounts.
 *
 *   GET /api/admin/accounts?q=&plan=
 *
 * The search is a match on the e-mail or the name; the plan is an exact
 * filter. The database does both, so the desk never has to hold the whole
 * account list to look through it.
 */
import { deskGuard, isPlan, listAccounts } from "@/lib/admin";


export async function GET(request: Request) {
  const guard = await deskGuard(request);
  if (!guard.ok) return guard.response;

  const params = new URL(request.url).searchParams;
  const plan = params.get("plan");
  const q = params.get("q") ?? "";

  const accounts = await listAccounts({
    q,
    plan: isPlan(plan) ? plan : null,
    limit: 100,
  });

  return Response.json(
    { accounts },
    { headers: { "cache-control": "no-store" } },
  );
}
