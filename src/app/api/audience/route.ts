/**
 * How many people are watching, right now.
 *
 * The count is measured at the proxy: every viewer of a channel asks for a
 * segment every few seconds, and each of those requests is counted once per
 * browser. It is our own audience, not a number borrowed from a directory.
 */
import { liveAudience, liveAudienceMap, totalAudience } from "@/lib/audience";


// A route that reads the request is dynamic on its own; the cache
// components build does not take a `dynamic` segment config.
export async function GET(request: Request) {
  const channel = new URL(request.url).searchParams.get("c");

  if (channel) {
    return Response.json(
      { channel, live: liveAudience(channel) },
      { headers: { "cache-control": "no-store" } },
    );
  }

  return Response.json(
    { live: liveAudienceMap(), total: totalAudience() },
    { headers: { "cache-control": "no-store" } },
  );
}
