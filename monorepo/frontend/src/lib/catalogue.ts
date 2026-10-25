import { CHANNELS } from "@/data/channels";
import { secondaryStreamUrl } from "@/lib/secondary";
import type { SecondaryMeta } from "@/lib/secondary";
import type {
  Channel,
  Server,
  UpstreamChannel,
  UpstreamServer,
} from "@/data/types";

/**
 * The catalogue, split in two.
 *
 * The browser must never hold an upstream address: not in the page, not in
 * the bundle, not in a devtools panel. The client gets a **public** view of
 * each channel — names, artwork, status, quality — and nothing that points at
 * the site the stream actually comes from.
 *
 * When the player wants a feed, it asks for it by reference:
 * `/api/player { channel }`. The server looks the upstream addresses up and
 * hands back a chain of our own URLs.
 */

const byId = new Map(CHANNELS.map((c) => [c.id, c]));

export type { Channel, UpstreamChannel, UpstreamServer };

/**
 * The slug the second source knows a channel by.
 *
 * A feed that came from the second source carries that source's own slug as
 * its id, so the mapping needs no guessing: the catalogue already holds it.
 */
export function secondarySlug(channel: UpstreamChannel): string | null {
  return channel.servers.find((server) => server.source === "secondary")?.id ?? null;
}

/**
 * How many people are watching a channel, when the second source counts.
 *
 * The count is read from the directory rather than from the catalogue: it
 * moves by the minute, and a number frozen at build time would be a lie
 * within the hour.
 */
export function viewsOf(
  channel: UpstreamChannel,
  meta?: Map<string, SecondaryMeta> | null,
): number | null {
  if (!meta) return null;
  const slug = secondarySlug(channel);
  if (!slug) return null;
  const views = meta.get(slug)?.views;
  return typeof views === "number" ? views : null;
}

/** The server as the browser sees it: no upstream address, no source page. */
export function toPublicChannel(
  channel: UpstreamChannel,
  meta?: Map<string, SecondaryMeta> | null,
): Channel {
  return {
    id: channel.id,
    name: channel.name,
    family: channel.family,
    familyKey: channel.familyKey,
    category: channel.category,
    logo: channel.logo,
    logoHd: channel.logoHd,
    logoDark: channel.logoDark,
    status: channel.status,
    quality: channel.quality,
    views: viewsOf(channel, meta),
    poster: channel.poster,
    stills: channel.stills ?? [],
    servers: channel.servers.map((server) => ({
      id: server.id,
      label: server.label,
      status: server.status,
      kind: server.kind,
      quality: server.quality,
      source: server.source,
    })),
  };
}

/**
 * The catalogue as the browser sees it.
 *
 * The directory's record is optional: without it the channels simply carry
 * no viewer count, which is honest — nobody counts them.
 */
export function toPublicChannels(
  channels: UpstreamChannel[],
  meta?: Map<string, SecondaryMeta> | null,
): Channel[] {
  return channels.map((channel) => toPublicChannel(channel, meta));
}

/** The full channel from the server-side catalogue. */
export function catalogueChannel(id: string): Channel | null {
  return byId.get(id) ?? null;
}

/**
 * Resolve `<channelId>.<serverId>` to the upstream address the server should
 * play. The playlist is preferred; the embed page is the fallback for a feed
 * that has no playlist.
 */
export async function resolveServerRef(ref: string): Promise<{
  channel: Channel;
  server: Server;
  url: string;
  kind: "hls" | "embed";
} | null> {
  const separator = ref.indexOf(".");
  if (separator <= 0) return null;

  const channel = byId.get(ref.slice(0, separator));
  if (!channel) return null;

  const server = channel.servers.find((s) => s.id === ref.slice(separator + 1));
  if (!server) return null;

  // The second source's addresses expire in minutes, so they are fetched
  // fresh instead of read from the catalogue.
  if (server.source === "secondary") {
    const url = await secondaryStreamUrl(server.id);
    return url ? { channel, server, url, kind: "hls" } : null;
  }

  if (server.hlsUrl) {
    return { channel, server, url: server.hlsUrl, kind: "hls" };
  }
  if (server.embedUrl) {
    return { channel, server, url: server.embedUrl, kind: "embed" };
  }
  return null;
}
