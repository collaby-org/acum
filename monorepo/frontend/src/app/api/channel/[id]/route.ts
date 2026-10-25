/**
 * The channel sheet.
 *
 *   GET /api/channel/<id>
 *
 * The panel asks for this when it opens, and gets back what the channel is:
 * its name, how many people watch it, what it is about and what is on the
 * air right now. The answer is finished on the server — the guide file and
 * the second source's directory are read here, never in the browser.
 *
 * The browser names a channel; it never names an upstream address.
 */
import { connection } from "next/server";
import { loadChannelDetail } from "@/lib/channel-detail";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  // The sheet is about now, so it is rendered per request.
  await connection();

  const { id } = await context.params;
  const detail = await loadChannelDetail(decodeURIComponent(id ?? ""));

  if (!detail) {
    return Response.json({ error: "Canal necunoscut." }, { status: 404 });
  }

  return Response.json(detail, {
    headers: { "cache-control": "no-store" },
  });
}
