import type { Metadata } from "next";
import { connection } from "next/server";
import {
  LinkRow,
  Note,
  PageHero,
  PageSection,
  Stat,
} from "@/components/pages/blocks";
import { ProgrammeSearch } from "@/components/pages/programme-search";
import { PageShell } from "@/components/pages/shell";
import { CHANNELS } from "@/data/channels";
import { toPublicChannels } from "@/lib/catalogue";
import { matchGuideChannels } from "@/components/now-next";
import {
  bucharestDay,
  dayLabel,
  getGuide,
  guideDays,
  requestMoment,
  weekdayLabel,
} from "@/lib/guide-pages";
import { getSecondaryMeta } from "@/lib/secondary";
import { SITE_NAME } from "@/lib/site";

/**
 * The programme search.
 *
 * The browser receives a compact index of the guide — never the file — and
 * filters it as the visitor types. The search is diacritics-insensitive,
 * because nobody types ş when they mean ș.
 */

export const instant = false;

export const metadata: Metadata = {
  title: "Caută o emisiune",
  description:
    `Caută o emisiune în ghidul TV al ${SITE_NAME}, pe toate canalele și pentru toate zilele publicate.`,
};

export default async function CautaOEmisiune() {
  await connection();

  const now = requestMoment();
  const meta = await getSecondaryMeta();
  const channels = toPublicChannels(CHANNELS, meta);
  const guide = await getGuide();

  const days = guideDays(guide, now);
  const ranges = days.map((day) => ({
    date: day.date,
    label: dayLabel(day.date),
    weekday: weekdayLabel(day.date),
    from: day.first,
    to: day.last,
  }));

  // The guide's channels, indexed: the search carries an index, not a name.
  const matched = matchGuideChannels(guide, channels);
  const catalogueBySlug = new Map<string, string>();
  for (const [id, guideChannel] of matched) {
    catalogueBySlug.set(guideChannel.slug, id);
  }

  const channelList: { name: string; id: string | null }[] = [];
  const channelIndex = new Map<string, number>();

  for (const channel of guide.channels) {
    channelIndex.set(channel.slug, channelList.length);
    channelList.push({
      name: channel.name,
      id: catalogueBySlug.get(channel.slug) ?? null,
    });
  }

  const slots: [string, number, number, number][] = [];
  for (const channel of guide.channels) {
    const index = channelIndex.get(channel.slug) ?? 0;
    for (const programme of channel.programmes) {
      slots.push([
        programme.title,
        index,
        programme.start,
        programme.end,
      ]);
    }
  }
  slots.sort((a, b) => a[2] - b[2]);

  const today = bucharestDay(now);

  return (
    <PageShell>
      <>
        <PageHero
          eyebrow="Ghid TV · căutare"
          title="Caută o emisiune"
          lead={
            <>
              Un singur câmp, tot ghidul. Scrie primele litere și vezi pe ce
              canal, în ce zi și la ce oră rulează emisiunea.
            </>
          }
          meta={
            <>
              <span>{slots.length} emisiuni în ghid</span>
              <span aria-hidden className="text-ink-faint/50">
                ·
              </span>
              <span>{channelList.length} canale</span>
              {days.length > 0 ? (
                <>
                  <span aria-hidden className="text-ink-faint/50">
                    ·
                  </span>
                  <span>{days.length} zile publicate</span>
                </>
              ) : null}
            </>
          }
        >
          <div className="grid max-w-3xl grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Emisiuni" value={slots.length} />
            <Stat label="Canale" value={channelList.length} />
            <Stat
              label="Zile publicate"
              value={days.length}
              hint={days[0] ? days[0].label : undefined}
            />
            <Stat
              label="Ziua de azi"
              value={days.some((day) => day.date === today) ? "publicată" : "nu"}
              hint="Ghidul acoperă în fiecare zi un interval."
            />
          </div>
        </PageHero>

        <PageSection className="py-12 sm:py-16">
          {guide.channels.length === 0 ? (
            <Note title="Ghidul nu este disponibil" tone="signal">
              <p>
                Fișierul ghidului nu a putut fi citit, deci căutarea nu are ce
                căuta. Pagina se reîncarcă la fiecare cerere.
              </p>
            </Note>
          ) : (
            <ProgrammeSearch
              channels={channelList}
              slots={slots}
              days={ranges}
              serverNow={now}
            />
          )}
        </PageSection>

        <PageSection className="pb-12 sm:pb-16">
          <Note title="Cât caută ghidul">
            <p>
              Căutarea se face în emisiunile pe care ghidul le publică — o zi
              care se rotește, plus primele ore ale zilei următoare. Nu este un
              registru al tuturor emisiunilor care au existat vreodată, iar
              site-ul nu completează lipsurile cu titluri inventate.
            </p>
            <p className="mt-3">
              Fiecare rezultat duce la canalul pe care rulează emisiunea, unde
              poți deschide playerul.
            </p>
          </Note>
        </PageSection>

        <PageSection className="pb-16 sm:pb-20">
          <LinkRow
            label="Mergi mai departe"
            links={[
              { label: "Ghid TV interactiv", href: "/ghid" },
              { label: "Ce rulează acum", href: "/azi" },
              { label: "Programul săptămânii", href: "/saptamana" },
              { label: "Top emisiuni", href: "/top-emisiuni" },
            ]}
          />
        </PageSection>
      </>
    </PageShell>
  );
}
