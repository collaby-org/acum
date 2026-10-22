/**
 * The catalogue model, shared by every layer.
 *
 * A *channel* is a real broadcast channel (Antena 1, HBO, CNN). A *server* is
 * one upstream feed of that channel — the source site lists the same channel
 * as "S1", "S2 HD", "S3" when it runs more than one feed for it. Servers are
 * alternatives, not different channels: the player tries them in order and
 * falls back to the next one when a server is down.
 *
 * There are two views of the catalogue, and the difference matters:
 *
 *   `Channel`   what the browser sees. Names, artwork, status, quality.
 *                No upstream address, no source page — the browser is never
 *                told where the stream comes from.
 *
 *   `Upstream…` what the server keeps. The same thing plus the addresses,
 *                which stay on this side of the proxy.
 *
 * This file is the contract. The generated catalogue in `channels.ts` and
 * every component in the app must match it.
 */

export type CategoryId =
  | "generaliste"
  | "stiri"
  | "sport"
  | "movies"
  | "kids"
  | "documentare"
  | "music";

export type Category = {
  id: CategoryId;
  label: string;
  tagline: string;
};

export type ServerStatus =
  /** The embed was verified serving a video player. */
  | "live"
  /** The upstream host refused the request (bot wall, parked domain). */
  | "blocked"
  /** The upstream host did not answer at all. */
  | "error"
  /** AceStream content id — a desktop protocol handler, no web player. */
  | "acestream"
  /** Not probed. */
  | "unknown"
  /** The source page ships no embeddable player. */
  | "none";

export type ServerKind = "iframe" | "acestream" | "none";

/** The measured picture quality of a feed. */
export type Quality = "uhd" | "fhd" | "hd" | "sd" | "low" | "unknown";

/**
 * One still of a broadcast, and the programme it belongs to.
 *
 * A still is a photograph of one moment of one channel, so it belongs to the
 * programme that was on air when it was taken. That link is what makes the
 * card's picture follow the schedule instead of sitting still: the card
 * picks the still that belongs to the programme on air right now.
 */
export type Still = {
  /** Where the still is stored, under `/posters`. */
  file: string;
  /** When the still was taken. */
  capturedAt: string | null;
  /**
   * The programme the still shows, when the capture knew which one it was.
   * A still without a programme is a picture of the channel and nothing
   * more: it cannot be tied to a slot, and it cannot go stale.
   */
  programme: {
    /** The name of the programme. */
    title: string;
    /** When it started, in epoch milliseconds. */
    startsAt: number;
    /** When it ends, in epoch milliseconds. */
    endsAt: number;
  } | null;
};

/** One upstream feed of a channel, as the browser sees it. */
export type Server = {
  /** Stable id, unique across the catalogue. */
  id: string;
  /** What the source calls it: "S1", "S2 HD", "S3". */
  label: string;
  status: ServerStatus;
  kind: ServerKind;
  /** The measured resolution of this feed. */
  quality: Quality;
  /**
   * Which directory the feed comes from. The second source hands out
   * short-lived stream addresses, so its feeds are resolved on the server at
   * the moment they are asked for.
   */
  source: "primary" | "secondary" | "canale-tv";
};

/** A real channel, with every upstream feed that carries it. */
export type Channel = {
  /** Stable id, unique across the catalogue. */
  id: string;
  /** Display name, in Romanian. */
  name: string;
  /** The family the source groups it under. */
  family: string;
  /** The source's raw family key. */
  familyKey: string;
  category: CategoryId;
  /** Local path to the channel logo, when one exists. */
  logo: string | null;
  /** The HD variant of the logo, when the channel publishes one. */
  logoHd: string | null;
  /** True when the logo is dark artwork and needs a light plate behind it. */
  logoDark: boolean;
  /** The best status across every server of this channel. */
  status: ServerStatus;
  /** The best quality across every server of this channel. */
  quality: Quality;
  /**
   * How many people are watching this channel right now, when a source
   * publishes it. `null` when nobody counts — the count is a live number,
   * not a fact about the channel.
   */
  views: number | null;
  /**
   * A still of the show that is on, used as the card's core promise. `null`
   * until the stills are fetched.
   */
  poster: string | null;
  /**
   * The stills of the programmes in the guide's window, newest first.
   *
   * The card picks the one that belongs to the programme on air right now,
   * so the picture follows the schedule: when the guide moves on, the card
   * moves with it.
   */
  stills: Still[];
  /** Upstream feeds, best first. The player walks this list. */
  servers: Server[];
};

/* ------------------------------------------------------------------ *
 * The server's view: the same, plus the addresses
 * ------------------------------------------------------------------ */

/** A feed with the addresses that stay on the server. */
export type UpstreamServer = Server & {
  /** The embed URL the source page ships. */
  embedUrl: string | null;
  /** The page on the source site that carries this feed. */
  sourcePage: string;
  /** A resolved HLS playlist, when one could be determined. */
  hlsUrl: string | null;
};

/** A channel with the addresses that stay on the server. */
export type UpstreamChannel = Omit<Channel, "servers"> & {
  /** The source's own logo URL. */
  logoRemote: string | null;
  servers: UpstreamServer[];
};

/** The best server of a channel: the first one that can actually play. */
export function primaryServer(channel: Channel): Server | undefined {
  return channel.servers.find((s) => s.status === "live") ?? channel.servers[0];
}

/** True when at least one feed of this channel can play in a browser. */
export function isPlayable(channel: Channel): boolean {
  return channel.servers.some(
    (s) =>
      s.status === "live" &&
      (s.source === "secondary" || s.kind === "iframe" || s.kind === "acestream"),
  );
}
