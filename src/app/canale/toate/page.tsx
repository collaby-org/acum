import type { Metadata } from "next";
import { connection } from "next/server";

export const dynamic = "force-dynamic";


import {
  ChannelDirectory,
  type DirectoryCategory,
  type DirectoryChannel,
} from "@/components/channel-directory";
import { PageHero } from "@/components/pages/blocks";
import { PageShell } from "@/components/pages/shell";
import {
  formatClock,
  matchGuideChannels,
  referenceMoment,
  resolveSchedule,
  type EpgGuide,
} from "@/components/now-next";
import { CATEGORIES, CHANNEL_COUNT, CHANNELS } from "@/data/channels";
import { liveAudienceMap } from "@/lib/audience";
import { toPublicChannels } from "@/lib/catalogue";
import { loadGuide } from "@/lib/guide";
import { CATEGORY_ORDER, sortChannels } from "@/lib/navigation";
import { getSecondaryMeta } from "@/lib/secondary";
import { SITE_NAME } from "@/lib/site";
import { plural } from "@/lib/utils";

/**
 * The directory: every channel, in one list.
 *
 * This is the page a visitor asked for when the catalogue answered with a
 * home page. The app at `/canale` is the product — the hero, the shelves,
 * the rails — and a rail is a shelf, not an index: it shows a dozen channels
 * and hides the rest. Here all of them are in one alphabetical list, with
 * the three ways of narrowing it down — a letter, a category, a search —
 * sitting above the list and intersecting with one another.
 *
 * The rows are links, not players. A content page does not own the player;
 * the channel's own page does, and that is where a row goes.
 *
 * Two numbers travel with the catalogue. The **live audience** is ours,
 * counted at the proxy. The **guide** says what is on now — it is read at
 * the request, so the row and the channel page agree.
 */


export const metadata: Metadata = {
  title: "Toate canalele, în ordine alfabetică",
  description: `Toate cele ${CHANNEL_COUNT} de canale din catalogul ${SITE_NAME}, într-o singură listă alfabetică: filtrează după literă sau categorie, ori caută după nume.`,
};

/** A guide that is not there: every channel falls back to its bare row. */
const NO_GUIDE: EpgGuide = { date: null, reference: null, channels: [] };

export default async function ToateCanalele() {
  // connection() omitted for static export

  const meta = await getSecondaryMeta();
  const channels = toPublicChannels(CHANNELS, meta);
  const guide = await loadGuide(channels);
  const live = liveAudienceMap();

  // The moment the guide is read against: the stamp the server put on it, so
  // the first paint and the rest of the page tell the same story. Reading the
  // clock here would be an impure render; the loader already read it.
  const moment = referenceMoment(guide);
  const matched = matchGuideChannels(guide ?? NO_GUIDE, channels);

  const rows: DirectoryChannel[] = sortChannels(channels).map((channel) => {
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

  const categories: DirectoryCategory[] = CATEGORY_ORDER.map((id) => ({
    id,
    label: CATEGORIES.find((entry) => entry.id === id)?.label ?? id,
  }));

  const liveCount = channels.filter(
    (channel) => channel.status === "live",
  ).length;

  return (
    <PageShell>
      <>
        <PageHero
          eyebrow="Catalog · director alfabetic"
          title="Toate canalele"
          lead={
            <>
              Fiecare canal din catalog, într-o singură listă, în ordine
              alfabetică. Litera, categoria și căutarea se combină: lista
              arată numai canalele care trec de toate trei.
            </>
          }
          meta={
            <>
              <span>
                {channels.length}{" "}
                {plural(channels.length, "canal", "canale", "de canale")}
              </span>
              <span aria-hidden className="text-ink-faint/50">
                ·
              </span>
              <span>{liveCount} live acum</span>
              <span aria-hidden className="text-ink-faint/50">
                ·
              </span>
              <span>{matched.size} au program în ghid</span>
            </>
          }
        />

        <ChannelDirectory channels={rows} categories={categories} />
      </>
    </PageShell>
  );
}
