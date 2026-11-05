/**
 * The player endpoint.
 *
 * `POST /api/player { channel }` — the manifest. The server resolves every
 * feed of the channel into a playlist URL, checks that each one answers, and
 * returns a single ordered chain the client can walk: when one link dies the
 * player moves to the next instead of showing a dead frame.
 *
 * The client names a channel; it never names an upstream address. The
 * catalogue that holds those addresses stays on the server.
 *
 * There is deliberately no way to ask this endpoint for an upstream page.
 * It used to serve one, framed, as a last resort — and that was wrong twice
 * over: the upstream hosts answer a request that does not carry their own
 * Referer with a redirect to Google, so the frame never played anything, and
 * the directory page it pointed at carried the name of the site we relay.
 * Every byte that reaches the browser now goes through the stream proxy,
 * which checks the address against an allowlist first.
 */
import {
  fetchPlayerPage,
  isAllowedMediaUrl,
  isResolvablePageUrl,
  isStreamTokenConfigured,
  probePlaylist,
  resolveStreamUrls,
  signStreamToken,
  StreamPolicyError,
  pickServer,
} from "@/lib/stream";
import { catalogueChannel } from "@/lib/catalogue";
import { secondaryStreamUrl } from "@/lib/secondary";
import { gate } from "@/lib/account-gate";
import { claimStream, deviceFrom } from "@/lib/stream-sessions";
import { bearerToken } from "@/lib/supabase/server";
import type { Server } from "@/data/types";

type ServerInput = {
  id?: unknown;
  label?: unknown;
  embedUrl?: unknown;
  sourcePage?: unknown;
  hlsUrl?: unknown;
  source?: unknown;
};

type ResolvedServer = {
  id: string;
  label: string;
  embedUrl: string | null;
  sourcePage: string | null;
  hlsUrl: string | null;
  source: "primary" | "secondary" | "canale-tv";
};

/**
 * How long one link may spend checking whether it answers.
 *
 * The catalogue already knows which feed is most likely to play. A probe is
 * only a short hint, so it gets a small budget of its own: a slow upstream
 * can never hold the phone's cold start open.
 */
const PROBE_BUDGET_MS = 1_200;

/**
 * How long the route may spend resolving the feeds of a channel.
 *
 * A feed whose playlist is already in the catalogue is free. A feed that
 * needs its page read — or the second source's fresh address — is worth a
 * short wait and no more: a slow upstream must not hold the answer open.
 * A feed that does not arrive inside the budget is left out of this answer,
 * without an error and without a delay.
 */
const RESOLVE_BUDGET_MS = 2_500;

/** The phases of the answer, in milliseconds. */
type PhaseTimings = {
  /** The paywall gate. */
  gate: number;
  /** The stream-session claim. */
  claim: number;
  /** The resolution of the feeds into addresses. */
  resolve: number;
  /** The check of each link. */
  probe: number;
};

/**
 * The phases of the answer, for the `Server-Timing` header.
 *
 * The header is the honest account of where the milliseconds went: the
 * gate and the claim talk to the account server, the resolution and the
 * probe talk to the upstream, and only one of them is ours to shorten.
 */
function serverTiming(timings: PhaseTimings): string {
  return [
    `gate;dur=${timings.gate}`,
    `claim;dur=${timings.claim}`,
    `resolve;dur=${timings.resolve}`,
    `probe;dur=${timings.probe}`,
  ].join(", ");
}

function readServer(value: ServerInput): ResolvedServer {
  return {
    id: typeof value.id === "string" ? value.id : "",
    label: typeof value.label === "string" ? value.label : "",
    embedUrl: typeof value.embedUrl === "string" ? value.embedUrl : null,
    sourcePage: typeof value.sourcePage === "string" ? value.sourcePage : null,
    hlsUrl: typeof value.hlsUrl === "string" ? value.hlsUrl : null,
    source:
      value.source === "secondary" || value.source === "canale-tv"
        ? value.source
        : "primary",
  };
}

/**
 * The playlists a feed can be read from, in the order the upstream lists.
 *
 * A playlist that was resolved at build time wins. Otherwise the feed's own
 * page is read and its obfuscation undone — that works for the player pages
 * on canale-tv.net and for the panels on the `.cfd` and `.shop` hosts alike.
 *
 * `deadline` is the moment the caller stops waiting, when it has one: the
 * page is then read only for as long as there is time left.
 */
async function candidatesOf(
  server: ResolvedServer,
  deadline?: number,
): Promise<string[]> {
  // The second source's addresses are short-lived, so they are fetched fresh
  // rather than read from the catalogue.
  if (server.source === "secondary") {
    const url = await secondaryStreamUrl(server.id, deadline);
    return url && isAllowedMediaUrl(url) ? [url] : [];
  }
  if (server.hlsUrl && isAllowedMediaUrl(server.hlsUrl)) {
    return [server.hlsUrl];
  }
  if (!isResolvablePageUrl(server.embedUrl)) return [];

  const html = await fetchPlayerPage(server.embedUrl, deadline);
  if (!html) return [];

  return resolveStreamUrls(html).filter(isAllowedMediaUrl);
}

/**
 * The candidates of one feed, if they arrive before the deadline.
 *
 * The route answers with what it has. A feed that needs its page read and
 * does not make it inside the budget is left out of this answer — no error,
 * no delay — and the request still running in the background is abandoned:
 * the response does not wait for it, and the deadline cuts the read short
 * on its own.
 */
async function candidatesWithin(
  server: ResolvedServer,
  deadline: number,
): Promise<string[]> {
  const left = deadline - Date.now();
  if (left <= 0) return [];

  let timer: ReturnType<typeof setTimeout> | undefined;
  const expired = new Promise<string[]>((resolve) => {
    timer = setTimeout(() => resolve([]), left);
  });

  try {
    return await Promise.race([candidatesOf(server, deadline), expired]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * A feed that has no playlist is a feed that does not play.
 *
 * There used to be a frame as a last resort — the page on the site that
 * publishes the feeds. It was wrong twice over: it shows the visitor the
 * name of the site we relay, which is the one thing this product must never
 * do, and it does not even work. The upstream hosts answer a request that
 * does not carry their own Referer with a redirect to Google, and a browser
 * can only send our address, so the panel inside the frame never gets its
 * picture. What rendered was Google's page.
 *
 * So the catalogue says a dead feed is dead, instead of dressing it up.
 */
export async function POST(request: Request) {
  /**
   * The gate.
   *
   * This route mints the signed address of a stream, so it is the place the
   * allowance is enforced. A visitor whose two hours are spent gets no
   * address at all — there is nothing to pull and nothing to bypass. The
   * client is told why, so it can show the wall.
   */
  const timings: PhaseTimings = { gate: 0, claim: 0, resolve: 0, probe: 0 };

  const gateStarted = Date.now();
  const verdict = await gate(request);
  timings.gate = Date.now() - gateStarted;
  if (!verdict.allowed) {
    return Response.json(
      { error: "paywall", reason: verdict.reason },
      { status: 403, headers: { "cache-control": "no-store", pragma: "no-cache" } },
    );
  }

  if (!isStreamTokenConfigured()) {
    return Response.json(
      { error: "Serviciul de streaming nu este configurat." },
      { status: 503, headers: { "cache-control": "no-store", pragma: "no-cache" } },
    );
  }

  let payload: {
    channel?: unknown;
    viewer?: unknown;
  };
  try {
    payload = (await request.json()) as {
      channel?: unknown;
      /** The viewer, as the browser named them. */
      viewer?: unknown;
    };
  } catch {
    return Response.json(
      { error: "Cerere invalidă." },
      { status: 400, headers: { "cache-control": "no-store", pragma: "no-cache" } },
    );
  }

  // The catalogue is the source of truth for the feeds. Browser-supplied
  // server objects are deliberately ignored: they would turn this endpoint
  // into a request forwarder for arbitrary upstream pages.
  if (typeof payload.channel !== "string") {
    return Response.json(
      { error: "Canalul este obligatoriu." },
      { status: 400, headers: { "cache-control": "no-store", pragma: "no-cache" } },
    );
  }

  const channel = catalogueChannel(payload.channel);
  if (!channel) {
    return Response.json(
      { error: "Canal necunoscut." },
      { status: 404, headers: { "cache-control": "no-store", pragma: "no-cache" } },
    );
  }

  // The catalogue's feeds, ordered by how likely they are to play: a
  // resolved playlist first, then the directory's own address, then the
  // pages whose obfuscation we can undo. Feeds that cannot produce a URL
  // (an acestream id, a dead page) are dropped here rather than shipped to
  // the browser to fail on.
  const servers = pickServer(channel).map(readServer);
  const channelId = channel.id;

  /**
   * The stream itself.
   *
   * The gate has already decided that the allowance is not spent. This is
   * the second question, and the one a plan is about: how many screens may
   * run at once, and is this the house's own device. A refusal here is not
   * a wall over the picture — it is a sentence the player can act on.
   */
  const authorization = bearerToken(request);
  const claimStarted = Date.now();
  const claim =
    authorization && verdict.userId
      ? await claimStream({
          token: authorization,
          userId: verdict.userId,
          device: deviceFrom(request),
          channelId,
        })
      : null;
  timings.claim = Date.now() - claimStarted;

  if (claim && !claim.allowed) {
    if (claim.reason === "stream_limit") {
      const one = claim.limit === 1;
      return Response.json(
        {
          error: `Ai atins limita de ${claim.limit} ${one ? "flux" : "fluxuri"} simultane din planul tău. Închide un alt ecran și reîncearcă.`,
          reason: claim.reason,
          limit: claim.limit,
          active: claim.active,
        },
        {
          status: 429,
          headers: { "cache-control": "no-store", pragma: "no-cache" },
        },
      );
    }

    return Response.json(
      {
        error:
          "Acest dispozitiv nu este cel înregistrat pentru casă. Confirmă dispozitivul și reluăm.",
        reason: claim.reason,
      },
      {
        status: 403,
        headers: { "cache-control": "no-store", pragma: "no-cache" },
      },
    );
  }

  const sessionId = claim?.allowed ? claim.sessionId : null;

  /**
   * The viewer.
   *
   * It is a random value the browser keeps for the session. It identifies a
   * browser, not a person, and it is the only thing the audience count is
   * built from — which is why it travels with every segment request.
   */
  const viewer =
    typeof payload.viewer === "string" && payload.viewer.length <= 64
      ? payload.viewer
      : null;

  let perServer: { server: ResolvedServer; candidates: string[] }[];
  const resolveStarted = Date.now();
  const resolveDeadline = resolveStarted + RESOLVE_BUDGET_MS;
  try {
    perServer = await Promise.all(
      servers.map(async (server) => ({
        server,
        candidates: await candidatesWithin(server, resolveDeadline),
      })),
    );
  } catch (error) {
    if (error instanceof StreamPolicyError) {
      return Response.json(
        { error: "Adresă nepermisă." },
        {
          status: 403,
          headers: { "cache-control": "no-store", pragma: "no-cache" },
        },
      );
    }
    throw error;
  }
  timings.resolve = Date.now() - resolveStarted;

  const seen = new Set<string>();
  const links: { server: ResolvedServer; candidate: string }[] = [];

  for (const entry of perServer) {
    for (const candidate of entry.candidates) {
      if (seen.has(candidate)) continue;
      seen.add(candidate);
      links.push({ server: entry.server, candidate });
    }
  }

  let sources: {
    id: string;
    label: string;
    kind: "hls";
    url: string;
    playable: boolean;
  }[];
  const probeStarted = Date.now();
  try {
    const probed = await Promise.all(
      links.map(async ({ server, candidate }) => {
        const url = `/api/stream?t=${signStreamToken(
          candidate,
          channelId ?? undefined,
          undefined,
          sessionId ?? undefined,
          viewer ?? undefined,
        )}`;
        return {
          id: server.id,
          label: server.label,
          kind: "hls" as const,
          // The channel, session and viewer are signed into the address, so
          // the proxy can count the audience per channel without trusting a
          // browser-supplied query parameter.
          url,
          playable: await probePlaylist(candidate, PROBE_BUDGET_MS),
        };
      }),
    );

    // A probe is a hint, never a veto. Links that answered are offered
    // first, while the catalogue order is kept inside each group: a link
    // that did not answer in the probe budget is still returned, so the
    // browser can be the better judge without the route waiting for it.
    const playable = probed.filter((source) => source.playable);
    const unanswered = probed.filter((source) => !source.playable);
    sources = [...playable, ...unanswered];
  } catch (error) {
    if (error instanceof StreamPolicyError) {
      return Response.json(
        { error: "Adresă nepermisă." },
        {
          status: 403,
          headers: { "cache-control": "no-store", pragma: "no-cache" },
        },
      );
    }
    throw error;
  }
  timings.probe = Date.now() - probeStarted;

  return Response.json(
    {
      sources,
      session: sessionId,
    },
    {
      headers: {
        "cache-control": "no-store",
        pragma: "no-cache",
        // Where the milliseconds went, for the person who is waiting.
        "server-timing": serverTiming(timings),
      },
    },
  );
}

export type { Server };
