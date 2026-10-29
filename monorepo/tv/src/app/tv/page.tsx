import type { Metadata } from "next";
import { connection } from "next/server";
import { CATEGORIES, CHANNELS } from "@/data/channels";
import { isPlayable } from "@/data/types";
import { liveAudienceMap } from "@/lib/audience";
import { loadGuide } from "@/lib/guide";
import { pickTrending } from "@/lib/popularity";
import { toPublicChannels } from "@/lib/catalogue";
import { getSecondaryMeta } from "@/lib/secondary";
import { TVDirectory } from "@/components/tv/directory";
import { TVNav } from "@/components/tv/nav";
import { TVShell } from "@/components/tv/shell";
import { SITE_NAME } from "@/lib/site";

/**
 * The television's front door.
 *
 * It is the same catalogue as `/canale` — the same channels, the same
 * guide, the same live headcount — in the shape a room can read: a banner,
 * then rows. It is a separate page rather than a variant of the web one
 * because a television is not a small desktop: the input is a D-pad, the
 * distance is three metres, and the sign-in is a QR code on a phone.
 *
 * It is rendered per request, like the rest of the guide: the "on air
 * right now" in every card is a fact about now, and caching it would show
 * yesterday's schedule on tomorrow's screen.
 */

export const metadata: Metadata = {
  title: "Televiziune",
  description: `Toate canalele românești live, pe un ecran mare. ${SITE_NAME}.`,
};

/** The page is about now. */
export const instant = false;

export default async function TVHome() {
  await connection();

  const meta = await getSecondaryMeta();
  const channels = toPublicChannels(CHANNELS, meta);
  const guide = await loadGuide(channels);
  const live = liveAudienceMap();
  // The banner carries a channel that actually plays. A channel whose
  // every feed is dead is a broken first impression, and the first
  // impression is the banner.
  const featured = pickTrending(channels, live, isPlayable);

  return (
    <>
      <TVNav />
      <TVShell className="min-h-dvh pb-24">
        <TVDirectory
          channels={channels}
          categories={CATEGORIES}
          guide={guide}
          live={live}
          featured={featured}
        />
      </TVShell>
    </>
  );
}
