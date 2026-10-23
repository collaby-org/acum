import { connection } from "next/server";
import { Browse } from "@/components/browse";
import { Footer } from "@/components/footer";
import { CATEGORIES, CHANNELS } from "@/data/channels";
import { isPlayable } from "@/data/types";
import { toPublicChannels } from "@/lib/catalogue";
import { getSecondaryMeta } from "@/lib/secondary";
import { loadGuide } from "@/lib/guide";
import { liveAudienceMap } from "@/lib/audience";
import { pickTrending } from "@/lib/popularity";

export const dynamic = "force-dynamic";



/**
 * The guide is about now, so the page is rendered per request.
 */

/**
 * The catalogue.
 *
 * The catalogue is stripped before it reaches the browser: the client gets
 * names, artwork, status and quality, but no upstream address and no source
 * page. When the player wants a feed it asks the server for it by reference.
 *
 * Two numbers arrive with it. The **live audience** is ours, counted at the
 * proxy, and it says how many people are watching here right now. The
 * **popularity** figure comes from the directory we index, and it is a
 * cumulative counter — a ranking, not a live count, and it is labelled as
 * one wherever it appears.
 *
 * This is the product, not the index: the hero, the shelves and one rail per
 * category. The whole catalogue, alphabetically and filterable, lives on its
 * own page — `/canale/toate`.
 */
export default async function Home() {
  // connection() omitted for static export

  const meta = await getSecondaryMeta();
  const channels = toPublicChannels(CHANNELS, meta);
  const guide = await loadGuide(channels);
  const live = liveAudienceMap();
  const featured = pickTrending(channels, live, isPlayable);

  return (
    <>
      <Browse
        channels={channels}
        categories={CATEGORIES}
        guide={guide}
        live={live}
        featured={featured}
      />
      <Footer />
    </>
  );
}
