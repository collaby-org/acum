/**
 * The stream proxy.
 *
 * The upstream media hosts only serve a real playlist when the request
 * carries a Referer they accept; without one they answer with a redirect to
 * Google or an HTML cloaking page. A browser cannot set a Referer, so the
 * stream is relayed here instead.
 *
 * Two ways in:
 *
 *   GET /api/stream?u=<absolute url>   the upstream URL, plain
 *   GET /api/stream?t=<token>          the same URL, signed and opaque
 *
 * Both are checked against the upstream allowlist, so the route can never be
 * pointed at an address of the caller's choosing.
 */
import {
  isAllowedMediaUrl,
  isPlaylist,
  openUpstream,
  readStreamToken,
  rewritePlaylist,
  signStreamToken,
} from "@/lib/stream";

const PLAYLIST_CONTENT_TYPE = "application/vnd.apple.mpegurl";
const SEGMENT_CONTENT_TYPE = "video/mp2t";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const token = params.get("t");
  const plain = params.get("u");

  const upstream = token ? readStreamToken(token) : plain;
  if (!upstream || !isAllowedMediaUrl(upstream)) {
    return new Response("Adresă nepermisă.", { status: 400 });
  }

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
    // keeps its Referer.
    const rewritten = rewritePlaylist(body, upstream, (absolute) =>
      token
        ? `/api/stream?t=${signStreamToken(absolute)}`
        : `/api/stream?u=${encodeURIComponent(absolute)}`,
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
