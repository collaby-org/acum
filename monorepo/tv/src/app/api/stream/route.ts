/**
 * The stream proxy.
 *
 * The upstream media hosts only serve a real playlist when the request
 * carries a Referer they accept; without one they answer with a redirect to
 * Google or an HTML cloaking page. A browser cannot set a Referer, so the
 * stream is relayed here instead.
 *
 * Three ways in:
 *
 *   GET /api/stream?s=<channelId>.<serverId>   the address stays on the server
 *   GET /api/stream?t=<token>                 the same URL, signed and opaque
 *   GET /api/stream?u=<absolute url>          the same URL, plain
 *
 * The first is what the app uses: the browser names a feed and never learns
 * where it comes from. All three are checked against the upstream allowlist,
 * so the route can never be pointed at an address of the caller's choosing.
 *
 * The proxy is also the only place that can see the whole audience: every
 * segment of every stream passes through here, so this is where the number
 * of people watching a channel is counted.
 */
import {
  isAllowedMediaUrl,
  isPlaylist,
  openUpstream,
  readStreamToken,
  rewritePlaylist,
  signStreamToken,
} from "@/lib/stream";
import { resolveServerRef } from "@/lib/catalogue";
import { touchAudience } from "@/lib/audience";

const PLAYLIST_CONTENT_TYPE = "application/vnd.apple.mpegurl";
const SEGMENT_CONTENT_TYPE = "video/mp2t";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const token = params.get("t");
  const plain = params.get("u");
  const reference = params.get("s");
  /** The viewer, as the browser named them. */
  const viewer = params.get("v");

  const signed = token ? readStreamToken(token) : null;
  let upstream = signed?.url ?? plain;
  let channelId = signed?.channelId ?? null;

  if (!upstream && reference) {
    const resolved = await resolveServerRef(reference);
    if (resolved?.kind === "hls") {
      upstream = resolved.url;
      channelId = resolved.channel.id;
    }
  }

  if (!upstream || !isAllowedMediaUrl(upstream)) {
    return new Response("Adresă nepermisă.", { status: 400 });
  }

  // The count. It happens here because here is the only place that sees
  // every viewer of every channel.
  if (channelId && viewer) touchAudience(channelId, viewer);

  const opened = await openUpstream(upstream);
  if (!opened) {
    return new Response("Flux indisponibil.", { status: 502 });
  }

  const { head, rest } = opened;
  const probe = new TextDecoder().decode(head.slice(0, 32));

  if (probe.trimStart().startsWith("#EXTM3U")) {
    const reader = rest.getReader();
    const chunks: Uint8Array[] = [];
    for (;;) {
      const next = await reader.read();
      if (next.done) break;
      chunks.push(next.value);
    }

    const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const merged = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      merged.set(chunk, offset);
      offset += chunk.length;
    }

    const body = new TextDecoder().decode(merged);
    if (!isPlaylist(body)) {
      return new Response("Flux indisponibil.", { status: 502 });
    }

    // Every URI goes back through the proxy, so the whole segment chain
    // keeps its Referer — and so every segment request carries the channel
    // and the viewer with it.
    const extra: Record<string, string> = {};
    if (channelId) extra.c = channelId;
    if (viewer) extra.v = viewer;

    const rewritten = rewritePlaylist(
      body,
      upstream,
      (absolute) =>
        token
          ? `/api/stream?t=${signStreamToken(absolute, channelId ?? undefined)}`
          : `/api/stream?u=${encodeURIComponent(absolute)}`,
      extra,
    );

    return new Response(rewritten, {
      headers: {
        "content-type": `${PLAYLIST_CONTENT_TYPE}; charset=utf-8`,
        "cache-control": "no-store",
      },
    });
  }

  return new Response(rest, {
    headers: {
      "content-type": SEGMENT_CONTENT_TYPE,
      "cache-control": "no-store",
    },
  });
}
