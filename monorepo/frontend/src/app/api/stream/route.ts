/**
 * The stream proxy.
 *
 * The upstream media hosts only serve a real playlist when the request
 * carries a Referer they accept; without one they answer with a redirect to
 * Google or an HTML cloaking page. A browser cannot set a Referer, so the
 * stream is relayed here instead.
 *
 * There is one way in: `GET /api/stream?t=<token>`. The token is minted by
 * the entitled player endpoint, is bound to an allowlisted upstream URL, and
 * carries the channel, session and signed viewer id. Raw URLs and catalogue
 * references are deliberately not accepted here.
 *
 * The proxy is also the only place that can see the whole audience: every
 * segment of every stream passes through here, so this is where the number
 * of people watching a channel is counted.
 */
import {
  isPlaylist,
  openUpstream,
  readStreamToken,
  rewritePlaylist,
  signStreamToken,
  StreamPolicyError,
} from "@/lib/stream";
import { touchAudience } from "@/lib/audience";

const PLAYLIST_CONTENT_TYPE = "application/vnd.apple.mpegurl";
const SEGMENT_CONTENT_TYPE = "video/mp2t";

/**
 * How long the upstream may take to answer at all.
 *
 * The live feed the proxy carries has an eight-second target duration:
 * the player asks for the playlist again every eight seconds, and a phone
 * that waits longer than that for a refreshed playlist has already lost
 * the live edge — Safari tears the session down rather than wait. So the
 * proxy answers inside the window, or it says plainly that the feed did
 * not answer; it never hangs for the full thirty seconds the upstream
 * read allows, because a refusal the player can retry is worth more than
 * a silence it can only give up on.
 */
const UPSTREAM_DEADLINE_MS = 5_000;

/** The upstream's answer, or null when it did not come in time. */
async function openInTime(
  upstream: string,
): Promise<Awaited<ReturnType<typeof openUpstream>>> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const expired = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), UPSTREAM_DEADLINE_MS);
  });

  try {
    return await Promise.race([openUpstream(upstream), expired]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const token = params.get("t");

  // Only a signed token opens this route. In particular, a raw `u=` or a
  // catalogue `s=` reference is not an alternative spelling of the same
  // request: accepting either would turn the proxy into open egress.
  if (params.has("u") || params.has("s")) {
    return new Response("Adresă nepermisă.", {
      status: 400,
      headers: { "cache-control": "no-store", pragma: "no-cache" },
    });
  }

  const signed = token ? readStreamToken(token) : null;
  if (!signed) {
    return new Response("Token invalid sau expirat.", {
      status: 403,
      headers: { "cache-control": "no-store", pragma: "no-cache" },
    });
  }

  const upstream = signed.url;
  const channelId = signed.channelId;
  const viewerId = signed.viewerId;

  // The count happens only on the signed-token path. The viewer id is part
  // of the signed payload, so it cannot be supplied or changed by the
  // browser as an unsigned query parameter.
  if (channelId && viewerId) touchAudience(channelId, viewerId);

  let opened;
  try {
    opened = await openInTime(upstream);
  } catch (error) {
    if (error instanceof StreamPolicyError) {
      return new Response("Adresă nepermisă.", {
        status: 403,
        headers: { "cache-control": "no-store", pragma: "no-cache" },
      });
    }
    throw error;
  }

  if (!opened) {
    return new Response("Flux indisponibil.", {
      status: 502,
      headers: { "cache-control": "no-store", pragma: "no-cache" },
    });
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
      return new Response("Flux indisponibil.", {
        status: 502,
        headers: { "cache-control": "no-store", pragma: "no-cache" },
      });
    }

    // Every URI goes back through the proxy with a fresh signed token. The
    // channel, stream session and viewer remain bound into every segment.
    const rewritten = rewritePlaylist(body, opened.finalUrl, (absolute) =>
      `/api/stream?t=${signStreamToken(
        absolute,
        channelId ?? undefined,
        undefined,
        signed.sessionId ?? undefined,
        viewerId ?? undefined,
      )}`,
    );

    return new Response(rewritten, {
      headers: {
        "content-type": `${PLAYLIST_CONTENT_TYPE}; charset=utf-8`,
        "cache-control": "no-store",
        pragma: "no-cache",
      },
    });
  }

  return new Response(rest, {
    headers: {
      "content-type": SEGMENT_CONTENT_TYPE,
      "cache-control": "no-store",
      pragma: "no-cache",
    },
  });
}
