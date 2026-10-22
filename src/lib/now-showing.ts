import {
  baseKey,
  foldKey,
  referenceMoment,
  resolveSchedule,
  type EpgChannel,
  type EpgGuide,
  type GuideChannelLike,
} from "@/components/now-next";

/**
 * What is on right now, read off the programme guide.
 *
 * The guide is loaded once per request and handed to the page whole, so the
 * only question a card has to answer is "which slot is playing on this
 * channel?". Answering it for 143 cards means matching 143 catalogue
 * channels against the guide — so the guide is indexed once and kept.
 */

/** The guide's channels, folded down to the keys a catalogue channel can match. */
type GuideIndex = Map<string, EpgChannel>;

const indexes = new WeakMap<EpgGuide, GuideIndex>();
const titles = new WeakMap<EpgGuide, Map<string, string | null>>();

function indexOf(guide: EpgGuide): GuideIndex {
  const cached = indexes.get(guide);
  if (cached) return cached;

  const index: GuideIndex = new Map();
  for (const channel of guide.channels) {
    for (const key of [foldKey(channel.slug), foldKey(channel.name)]) {
      if (key && !index.has(key)) index.set(key, channel);
    }
  }
  indexes.set(guide, index);
  return index;
}

/** The guide channel a catalogue channel belongs to, if any. */
function match(
  index: GuideIndex,
  channel: GuideChannelLike,
): EpgChannel | null {
  const candidates = [channel.id, channel.name, channel.family, channel.familyKey];

  for (const candidate of candidates) {
    const hit = index.get(foldKey(candidate));
    if (hit) return hit;
  }
  for (const candidate of candidates) {
    const key = baseKey(candidate);
    if (!key) continue;
    const hit = index.get(key);
    if (hit) return hit;
  }
  return null;
}

/**
 * The title of the show on air right now, or null when the guide does not
 * cover the channel or nothing is playing.
 *
 * The moment is the guide's own reference — the page is rendered per
 * request, so the guide was prepared seconds ago and its clock is the
 * present. A card that kept a timer of its own would drift away from the
 * guide it reads.
 */
export function nowShowing(
  guide: EpgGuide | null | undefined,
  channel: GuideChannelLike,
  moment?: number,
): string | null {
  if (!guide || guide.channels.length === 0) return null;

  const guideChannel = match(indexOf(guide), channel);
  if (!guideChannel) return null;

  let cache = titles.get(guide);
  if (!cache) {
    cache = new Map();
    titles.set(guide, cache);
  }
  const cached = cache.get(guideChannel.slug);
  if (cached !== undefined) return cached;

  const at = moment ?? referenceMoment(guide);
  const title = resolveSchedule(guideChannel, at).now?.title ?? null;
  cache.set(guideChannel.slug, title);
  return title;
}
