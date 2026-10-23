/**
 * The numbers the desk opens on.
 *
 *   GET /api/admin/overview
 *
 * The live audience comes from the proxy's own counter — the same one the
 * home page reads — and the rest comes from the database. Nothing here is
 * cached: the crowd moves, and a number that stopped counting would be a
 * number that started lying.
 */
import { liveAudienceMap, totalAudience } from "@/lib/audience";

import {
  catalogueRows,
  catalogueSummary,
  dailySeries,
  deskGuard,
  recentRegistrations,
  todayNumbers,
} from "@/lib/admin";

export async function GET(request: Request) {
  const guard = await deskGuard(request);
  if (!guard.ok) return guard.response;

  const [series, recent] = await Promise.all([
    dailySeries(30),
    recentRegistrations(6),
  ]);
  const today = await todayNumbers(series);

  // The audience is counted per channel id; the desk shows names.
  const live = liveAudienceMap();
  const names = new Map(catalogueRows().map((channel) => [channel.id, channel.name]));
  const liveTop = Object.entries(live)
    .map(([id, count]) => ({ id, name: names.get(id) ?? id, count }))
    .sort((a, b) => b.count - a.count);

  return Response.json(
    {
      live,
      liveTop,
      total: totalAudience(),
      today,
      series,
      recent,
      catalogue: catalogueSummary(),
    },
    { headers: { "cache-control": "no-store" } },
  );
}
