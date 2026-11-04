/**
 * Resolve one upstream player page into the playlist URLs it hides.
 *
 * The upstream player computes its HLS URL at runtime, behind an obfuscation
 * and behind a Referer check. This route reads the page, undoes the
 * obfuscation without executing any of it, and hands back the mirrors the
 * upstream itself would use — each wrapped in a signed proxy token so the
 * browser never talks to the upstream host directly.
 *
 * The route carries the same account entitlement as `/api/player`: it mints
 * usable stream addresses, so an anonymous request receives none.
 *
 * GET /api/resolve?src=<upstream player page>
 *
 * No client or script currently calls this route. It is kept behind the same
 * account gate as `/api/player` because it still mints playable stream
 * tokens.
 */
import {
  fetchPlayerPage,
  isAllowedMediaUrl,
  isAllowedPlayerUrl,
  isStreamTokenConfigured,
  probePlaylist,
  resolveStreamUrls,
  signStreamToken,
  StreamPolicyError,
} from "@/lib/stream";
import { gate } from "@/lib/account-gate";

const NO_STORE_HEADERS = {
  "cache-control": "no-store",
  pragma: "no-cache",
};

export async function GET(request: Request) {
  const verdict = await gate(request);
  if (!verdict.allowed) {
    return Response.json(
      { error: "paywall", reason: verdict.reason },
      { status: 403, headers: NO_STORE_HEADERS },
    );
  }

  if (!isStreamTokenConfigured()) {
    return Response.json(
      { error: "Serviciul de streaming nu este configurat." },
      { status: 503, headers: NO_STORE_HEADERS },
    );
  }

  const src = new URL(request.url).searchParams.get("src");

  if (!isAllowedPlayerUrl(src)) {
    return Response.json(
      { error: "Sursa nu este permisă." },
      { status: 403, headers: NO_STORE_HEADERS },
    );
  }

  let html: string | null;
  try {
    html = await fetchPlayerPage(src);
  } catch (error) {
    if (error instanceof StreamPolicyError) {
      return Response.json(
        { error: "Adresă nepermisă." },
        { status: 403, headers: NO_STORE_HEADERS },
      );
    }
    throw error;
  }

  if (!html) {
    return Response.json(
      { error: "Pagina sursă nu a putut fi citită." },
      { status: 502, headers: NO_STORE_HEADERS },
    );
  }

  const urls = resolveStreamUrls(html).filter(isAllowedMediaUrl);
  if (urls.length === 0) {
    return Response.json(
      { error: "Fluxul nu a putut fi rezolvat." },
      { status: 404, headers: NO_STORE_HEADERS },
    );
  }

  let sources: { url: string; playable: boolean }[];
  try {
    sources = await Promise.all(
      urls.map(async (url) => ({
        url: `/api/stream?t=${signStreamToken(url)}`,
        playable: await probePlaylist(url),
      })),
    );
  } catch (error) {
    if (error instanceof StreamPolicyError) {
      return Response.json(
        { error: "Adresă nepermisă." },
        { status: 403, headers: NO_STORE_HEADERS },
      );
    }
    throw error;
  }

  const ordered = [
    ...sources.filter((source) => source.playable),
    ...sources.filter((source) => !source.playable),
  ];

  return Response.json({ sources: ordered }, { headers: NO_STORE_HEADERS });
}
