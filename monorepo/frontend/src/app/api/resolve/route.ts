/**
 * Resolve one upstream player page into the playlist URLs it hides.
 *
 * The upstream player computes its HLS URL at runtime, behind an obfuscation
 * and behind a Referer check. This route reads the page, undoes the
 * obfuscation without executing any of it, and hands back the mirrors the
 * upstream itself would use — each wrapped in a signed proxy token so the
 * browser never talks to the upstream host directly.
 *
 * GET /api/resolve?src=<upstream player page>
 */
import {
  fetchPlayerPage,
  isAllowedMediaUrl,
  isAllowedPlayerUrl,
  probePlaylist,
  resolveStreamUrls,
  signStreamToken,
} from "@/lib/stream";

export async function GET(request: Request) {
  const src = new URL(request.url).searchParams.get("src");

  if (!isAllowedPlayerUrl(src)) {
    return Response.json(
      { error: "Sursa nu este permisă." },
      { status: 400 },
    );
  }

  const html = await fetchPlayerPage(src);
  if (!html) {
    return Response.json(
      { error: "Pagina sursă nu a putut fi citită." },
      { status: 502 },
    );
  }

  const urls = resolveStreamUrls(html).filter(isAllowedMediaUrl);
  if (urls.length === 0) {
    return Response.json(
      { error: "Fluxul nu a putut fi rezolvat." },
      { status: 404 },
    );
  }

  const sources = await Promise.all(
    urls.map(async (url) => ({
      url: `/api/stream?t=${signStreamToken(url)}`,
      playable: await probePlaylist(url),
    })),
  );

  const ordered = [
    ...sources.filter((source) => source.playable),
    ...sources.filter((source) => !source.playable),
  ];

  return Response.json({ sources: ordered });
}
