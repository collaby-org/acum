import {
  baseKey,
  foldKey,
  resolveSchedule,
  type EpgChannel,
  type EpgGuide,
  type EpgProgramme,
  type GuideChannelLike,
} from "@/components/now-next";

/**
 * What is on right now, read off the programme guide.
 *
 * The guide is loaded once per request and handed to the page whole, so the
 * only question a card has to answer is "which slot is playing on this
 * channel, at this moment?". Answering it for 143 cards means matching 143
 * catalogue channels against the guide — so the guide is indexed once and
 * kept.
 *
 * The moment is always given by the caller. The guide is a snapshot of one
 * day, and only the clock can say where inside that day we are; a reader
 * that fell back to the guide's own reference would keep naming the show
 * that was on when the file was written.
 */

/** The guide's channels, folded down to the keys a catalogue channel can match. */
type GuideIndex = Map<string, EpgChannel>;

/** What the guide said about a channel, and the minute it was read at. */
type Reading = {
  /** The minute the reading was taken in. */
  minute: number;
  /** The slot on air at that minute. */
  programme: EpgProgramme | null;
};

/** Everything the guide is asked once and then remembered. */
type GuideRecord = {
  /** The guide's channels, by the keys a catalogue channel can match. */
  index: GuideIndex;
  /** What is on air, by catalogue channel id. */
  readings: Map<string, Reading>;
};

const records = new WeakMap<EpgGuide, GuideRecord>();

/** The minute a moment falls in. */
function minuteOf(moment: number): number {
  return Math.floor(moment / 60_000);
}

function recordOf(guide: EpgGuide): GuideRecord {
  const cached = records.get(guide);
  if (cached) return cached;

  const index: GuideIndex = new Map();
  for (const channel of guide.channels) {
    for (const key of [foldKey(channel.slug), foldKey(channel.name)]) {
      if (key && !index.has(key)) index.set(key, channel);
    }
  }

  const record: GuideRecord = { index, readings: new Map() };
  records.set(guide, record);
  return record;
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
 * The programme on air on a channel, at a moment.
 *
 * The reading is kept for the minute it was taken in: a card is rendered
 * again and again while the page is open, and the guide does not change
 * within the minute, so the answer is asked of the guide once a minute and
 * not once a render.
 */
export function nowProgramme(
  guide: EpgGuide | null | undefined,
  channel: GuideChannelLike,
  moment: number,
): EpgProgramme | null {
  if (!guide || guide.channels.length === 0) return null;
  if (!Number.isFinite(moment) || moment <= 0) return null;

  const record = recordOf(guide);
  const guideChannel = match(record.index, channel);
  if (!guideChannel) return null;

  const minute = minuteOf(moment);
  const cached = record.readings.get(channel.id);
  if (cached && cached.minute === minute) return cached.programme;

  const programme = resolveSchedule(guideChannel, moment).now ?? null;
  record.readings.set(channel.id, { minute, programme });
  return programme;
}

/**
 * The title of the show on air right now, or null when the guide does not
 * cover the channel or nothing is playing.
 */
export function nowShowing(
  guide: EpgGuide | null | undefined,
  channel: GuideChannelLike,
  moment: number,
): string | null {
  return nowProgramme(guide, channel, moment)?.title ?? null;
}
