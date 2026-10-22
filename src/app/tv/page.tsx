import type { Metadata } from "next";
import { connection } from "next/server";
import { TVDirectory } from "@/components/tv/tv-directory";
import {
  formatClock,
  matchGuideChannels,
  referenceMoment,
  resolveSchedule,
  type EpgGuide,
} from "@/components/now-next";
import { liveAudienceMap } from "@/lib/audience";
import { toPublicChannels } from "@/lib/catalogue";
import { loadGuide } from "@/lib/guide";
import { sortChannels } from "@/lib/navigation";
import { CATEGORIES, CHANNEL_COUNT, CHANNELS } from "@/data/channels";
import { getSecondaryMeta } from "@/lib/secondary";
import { SITE_NAME } from "@/lib/site";
import { plural } from "@/lib/utils";

/**
 * The TV browse page: every channel in one alphabetical grid, each card a
 * button that opens a sticky `VideoPlayer`. Built for a remote's D-pad, not
 * the mouse — every visual state shows up, cards are big enough to read and
 * press with one thumb, and the picture stays pinned while the grid scrolls.
 */

const NO_GUIDE: EpgGuide = { date: null, reference: null, channels: [] };

export const instant = false;

export const metadata: Metadata = {
  title: "Toate canalele, pe televioare",
  description: `Toate cele ${CHANNEL_COUNT} de canale din catalogul ${SITE_NAME}, într-o listă alabetă și simplă ce poți căola de pe un controlul telecomătorului.`,
};

export default async function TVPage() {
  await connection();

  const meta = await getSecondaryMeta();
  const channels = toPublicChannels(CHANNELS, meta);
  const guide = await loadGuide(channels);
  const live = liveAudienceMap();

  const moment = referenceMoment(guide);
  const matched = matchGuideChannels(guide ?? NO_GUIDE, channels);

  // The rows are what `TVDirectory` renders as cards, alphabetically sorted
  // so the grid reads A-Z across every row — no section jumps for a remote.
  const rows = sortChannels(channels).map((channel) => {
    const guideChannel = matched.get(channel.id) ?? null;
    const now = guideChannel ? resolveSchedule(guideChannel, moment).now : null;
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
      now: now?.title ?? null,
      until: now ? formatClock(now.end) : null,
      viewers: live[channel.id] ?? 0,
    };
  });

  return (
    <TVDirectory
      channels={rows}
      liveCount={rows.filter((channel) => channel.status === "live").length}
    />
  );
}
