/**
 * The catalogue model, shared by every layer.
 *
 * A *channel* is a real broadcast channel (Antena 1, HBO, CNN). A *server* is
 * one upstream feed of that channel — the source site lists the same channel
 * as "S1", "S2 HD", "S3" when it runs more than one feed for it. Servers are
 * alternatives, not different channels: the player tries them in order and
 * falls back to the next one when a server is down.
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

/** How an upstream feed behaves. */
export type ServerStatus =
  /** The embed was verified serving a video player. */
  | "live"
  /** The upstream host refused the request (bot wall, parked domain). */
  | "blocked"
  /** The upstream host did not answer. */
  | "error"
  /** AceStream content id — a desktop protocol handler, no web player. */
  | "acestream"
  /** Not probed yet. */
  | "unknown"
  /** The source page ships no embeddable player. */
  | "none";

export type ServerKind = "iframe" | "acestream" | "none";

/** One upstream feed of a channel. */
export type Server = {
  /** Stable id, unique across the catalogue. */
  id: string;
  /** What the source calls it: "S1", "S2 HD", "S3". */
  label: string;
  /** The embed URL the source page ships. */
  embedUrl: string | null;
  /** The page on the source site that carries this feed. */
  sourcePage: string;
  status: ServerStatus;
  kind: ServerKind;
  /**
   * A resolved HLS playlist for this feed, when one could be determined.
   * Played directly through the app's own player — no upstream chrome, no
   * ads, instant start.
   */
  hlsUrl: string | null;
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
  /** The source's own logo URL. */
  logoRemote: string | null;
  /** The best status across every server of this channel. */
  status: ServerStatus;
  /** Upstream feeds, best first. The player walks this list. */
  servers: Server[];
};

/** The best server of a channel: the first one that can actually play. */
export function primaryServer(channel: Channel): Server | undefined {
  return channel.servers.find((s) => s.status === "live") ?? channel.servers[0];
}

/** True when at least one feed of this channel can play in a browser. */
export function isPlayable(channel: Channel): boolean {
  return channel.servers.some(
    (s) => s.status === "live" && (s.hlsUrl !== null || s.embedUrl !== null),
  );
}
