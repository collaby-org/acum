/**
 * What people are watching, right now.
 *
 *   GET /api/trending
 *
 * The second source counts the viewers of every channel it carries. This
 * route turns that count into the catalogue's own channels — the ones the
 * browser can actually open — and puts them in order, the most watched
 * first.
 *
 * The `id` is the catalogue id, never the second source's slug: the browser
 * asks for a channel by catalogue id everywhere else, and a second id would
 * be one more thing to keep in step.
 */
import { CHANNELS } from "@/data/channels";
import { secondarySlug } from "@/lib/catalogue";
import { getSecondaryMeta } from "@/lib/secondary";

/** The list is about now, so it is never rendered ahead of time. */
export async function GET() {
  const meta = await getSecondaryMeta();

  const channels = CHANNELS.flatMap((channel) => {
    const slug = secondarySlug(channel);
    if (!slug) return [];
    const entry = meta.get(slug);
    if (!entry || typeof entry.views !== "number") return [];
    return [
      {
        id: channel.id,
        name: channel.name,
        views: entry.views,
        category: entry.category,
      },
    ];
  }).sort((a, b) => b.views - a.views);

  return Response.json(
    { channels },
    { headers: { "cache-control": "no-store" } },
  );
}
