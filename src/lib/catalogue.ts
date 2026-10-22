import { CHANNELS } from "@/data/channels";
import { secondaryStreamUrl } from "@/lib/secondary";
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

/** The server as the browser sees it: no upstream address, no source page. */
export function toPublicChannel(channel: UpstreamChannel): Channel {
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

export function toPublicChannels(channels: UpstreamChannel[]): Channel[] {
  return channels.map(toPublicChannel);
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
