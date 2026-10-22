import type { CategoryId, Quality, ServerStatus } from "@/data/types";

/* ------------------------------------------------------------------ *
 * Status
 * ------------------------------------------------------------------ */

/** The status union, under the name the catalogue used to export it. */
export type ChannelStatus = ServerStatus;

export type StatusTone = "live" | "warn" | "muted" | "none";

export const STATUS_META: Record<
  ServerStatus,
  { label: string; tone: StatusTone; hint: string }
> = {
  live: {
    label: "Live",
    tone: "live",
    hint: "Player verificat — streamul pornește.",
  },
  blocked: {
    label: "Indisponibil",
    tone: "warn",
    hint: "Gazda sursă refuză cererea din rețeaua noastră. Poate funcționa de acasă.",
  },
  acestream: {
    label: "Necesită plugin",
    tone: "muted",
    hint: "Canalul folosește protocolul AceStream, care nu are player web.",
  },
  error: {
    label: "Fără răspuns",
    tone: "warn",
    hint: "Gazda sursă nu a răspuns la verificare.",
  },
  unknown: {
    label: "Neverificat",
    tone: "muted",
    hint: "Statusul canalului nu a putut fi verificat.",
  },
  none: {
    label: "Fără sursă",
    tone: "none",
    hint: "Pagina sursă nu conține un player încorporabil.",
  },
};

/* ------------------------------------------------------------------ *
 * Colour
 * ------------------------------------------------------------------ */

const CATEGORY_HUE: Record<CategoryId, number> = {
  generaliste: 26,
  stiri: 212,
  sport: 142,
  movies: 276,
  kids: 192,
  documentare: 164,
  music: 322,
};

function hash(value: string) {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

/** A stable, on-palette hue per family — siblings stay related, families differ. */
export function familyHue(familyKey: string, category: CategoryId) {
  const base = CATEGORY_HUE[category] ?? 220;
  const spread = (hash(familyKey) % 26) - 13;
  return (base + spread + 360) % 360;
}

export type PosterPalette = {
  hue: number;
  from: string;
  via: string;
  to: string;
  glow: string;
};

export function posterPalette(familyKey: string, category: CategoryId): PosterPalette {
  const hue = familyHue(familyKey, category);
  return {
    hue,
    from: `hsl(${hue} 62% 20%)`,
    via: `hsl(${(hue + 18) % 360} 55% 9%)`,
    to: `hsl(${(hue + 330) % 360} 40% 5%)`,
    glow: `hsl(${hue} 90% 58% / 0.35)`,
  };
}

/* ------------------------------------------------------------------ *
 * Servers
 * ------------------------------------------------------------------ */

/** A channel and the upstream feeds that carry it. */
export type ServerLike = {
  id?: string;
  label: string;
  embedUrl?: string | null;
  hlsUrl?: string | null;
  status?: ServerStatus;
  quality?: Quality;
  source?: "primary" | "secondary" | "canale-tv";
};

/** How many upstream feeds this channel has. */
export function serverCount(channel: { servers?: readonly ServerLike[] }): number {
  return channel.servers?.length ?? 0;
}

/** The feed labels, in the order the player will try them: "S1", "S2 HD". */
export function serverLabels(channel: { servers?: readonly ServerLike[] }): string[] {
  return (channel.servers ?? []).map((server) => server.label);
}

/**
 * The badge text for the feed stack: "S1 · S2", plus a counter once the
 * stack grows past two.
 */
export function serverSummary(channel: { servers?: readonly ServerLike[] }): string {
  const labels = serverLabels(channel);
  if (labels.length <= 2) return labels.join(" · ");
  return `${labels.slice(0, 2).join(" · ")} +${labels.length - 2}`;
}

/* ------------------------------------------------------------------ *
 * Quality
 * ------------------------------------------------------------------ */

/** How a quality is shown to the visitor. */
export const QUALITY_META: Record<
  Quality,
  { label: string; showBadge: boolean; rank: number }
> = {
  uhd: { label: "UHD", showBadge: true, rank: 0 },
  fhd: { label: "FHD", showBadge: true, rank: 1 },
  hd: { label: "HD", showBadge: true, rank: 2 },
  sd: { label: "SD", showBadge: false, rank: 3 },
  low: { label: "SD", showBadge: false, rank: 4 },
  unknown: { label: "", showBadge: false, rank: 5 },
};

/** The best quality across a channel's feeds. */
export function bestQuality(channel: {
  quality?: Quality;
  servers?: readonly { quality?: Quality }[];
}): Quality {
  if (channel.servers?.length) {
    let best: Quality = "unknown";
    for (const server of channel.servers) {
      const q = server.quality ?? "unknown";
      if (QUALITY_META[q].rank < QUALITY_META[best].rank) best = q;
    }
    return best;
  }
  return channel.quality ?? "unknown";
}

/** True when the channel should carry an HD badge. */
export function isHighDefinition(channel: {
  quality?: Quality;
  servers?: readonly { quality?: Quality }[];
}): boolean {
  return QUALITY_META[bestQuality(channel)].showBadge;
}

/* ------------------------------------------------------------------ *
 * Sorting
 * ------------------------------------------------------------------ */

/** Live channels first, then HD before SD, then alphabetical. */
export function byPlayability(
  a: { name: string; status: ServerStatus; quality?: Quality },
  b: { name: string; status: ServerStatus; quality?: Quality },
) {
  const rank = (c: { status: ServerStatus; quality?: Quality }) =>
    c.status === "live" ? 0 : c.status === "blocked" ? 1 : c.status === "unknown" ? 2 : 3;
  const diff = rank(a) - rank(b);
  if (diff !== 0) return diff;
  const quality = QUALITY_META[a.quality ?? "unknown"].rank - QUALITY_META[b.quality ?? "unknown"].rank;
  if (quality !== 0) return quality;
  return a.name.localeCompare(b.name, "ro");
}

/**
 * True when at least one feed of this channel can play in a browser.
 *
 * The public model in `src/data/types.ts` answers this, and it is the only
 * answer: a second copy of the rule here would drift from it, and the rail
 * of live channels would quietly come up empty.
 */
export function isPlayable(channel: {
  status: ServerStatus;
  servers?: readonly ServerLike[];
}): boolean {
  if (channel.servers?.length) {
    return channel.servers.some(
      (server) =>
        server.status === "live" &&
        (server.source === "secondary" ||
          server.source === "canale-tv" ||
          Boolean(server.embedUrl) ||
          Boolean(server.hlsUrl)),
    );
  }
  return channel.status === "live";
}

export function hasEmbed(channel: {
  embedUrl?: string | null;
  servers?: readonly ServerLike[];
}): boolean {
  if (channel.servers) {
    return channel.servers.some((server) => Boolean(server.embedUrl));
  }
  return Boolean(channel.embedUrl);
}
