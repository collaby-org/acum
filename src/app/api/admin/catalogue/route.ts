/**
 * The catalogue, as the desk is allowed to see it.
 *
 *   GET /api/admin/catalogue
 *
 * The same public view the visitor gets: names, artwork, status, quality.
 * No upstream address, no source page, and no feed stack — a channel's
 * number of feeds is not something the browser is told, here or anywhere
 * else. The totals are there: how many channels, how many feeds, how many
 * are live, how many have a spare one.
 */
import { liveAudienceMap, totalAudience } from "@/lib/audience";
import { catalogueRows, catalogueSummary, deskGuard } from "@/lib/admin";


export async function GET(request: Request) {
  const guard = await deskGuard(request);
  if (!guard.ok) return guard.response;

  return Response.json(
    {
      channels: catalogueRows(),
      summary: catalogueSummary(),
      live: liveAudienceMap(),
      total: totalAudience(),
    },
    { headers: { "cache-control": "no-store" } },
  );
}
