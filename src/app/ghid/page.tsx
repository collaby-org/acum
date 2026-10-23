import type { Metadata } from "next";
import { connection } from "next/server";

export const dynamic = "force-dynamic";


import {
  LinkRow,
  Note,
  PageHero,
  PageSection,
  Stat,
} from "@/components/pages/blocks";
import { GuideExplorer } from "@/components/pages/guide-explorer";
import { PageShell } from "@/components/pages/shell";
import { CHANNELS } from "@/data/channels";
import { toPublicChannels } from "@/lib/catalogue";
import { matchGuideChannels } from "@/components/now-next";
import {
  bucharestDay,
  dayLabel,
  getGuide,
  guideDays,
  programmesOn,
  requestMoment,
  weekdayLabel,
} from "@/lib/guide-pages";
import { getSecondaryMeta } from "@/lib/secondary";
import { readSearchParams } from "@/lib/export-safe";
import { SITE_NAME } from "@/lib/site";

/**
 * The interactive guide.
 *
 * The page is the hinge between the three programme pages: it is the only
 * one that shows a whole channel's day at once, and it links to the day and
 * the week.
 *
 * The browser receives a compact index of the guide — a title, a start and
 * an end per slot — and never the file.
 */


export const metadata: Metadata = {
  title: "Ghid TV interactiv",
  description:
    `Ghidul TV interactiv ${SITE_NAME}: alege un canal și vezi programul lui, zi cu zi, cu tot ce rulează în aer.`,
};

type Props = {
  searchParams: Promise<{ canal?: string; zi?: string }>;
};

export default async function Ghid({ searchParams }: Props) {
  // connection() omitted for static export

  const now = requestMoment();
  const meta = await getSecondaryMeta();
  const channels = toPublicChannels(CHANNELS, meta);
  const guide = await getGuide();
  const params = await readSearchParams(searchParams);

  const days = guideDays(guide, now);
  const ranges = days.map((day) => ({
    date: day.date,
    label: dayLabel(day.date),
    weekday: weekdayLabel(day.date),
    from: day.first,
    to: day.last,
  }));

  // The catalogue id behind each guide channel, so a slot can be linked to
  // the channel's own page.
  const matched = matchGuideChannels(guide, channels);
  const catalogue: Record<string, string> = {};
  for (const [id, guideChannel] of matched) {
    catalogue[guideChannel.slug] = id;
  }

  const wanted = (params.canal as string | undefined) ?? null;
  const slug =
    wanted && guide.channels.some((channel) => channel.slug === wanted)
      ? wanted
      : (guide.channels[0]?.slug ?? null);

  const wantedDay = (params.zi as string | undefined) ?? null;
  const day =
    wantedDay && days.some((entry) => entry.date === wantedDay)
      ? wantedDay
      : (days[0]?.date ?? null);

  const slots: Record<string, [string, number, number][]> = {};
  const summaries: { slug: string; name: string; count: number }[] = [];
  for (const channel of guide.channels) {
    slots[channel.slug] = channel.programmes.map((programme) => [
      programme.title,
      programme.start,
      programme.end,
    ]);
    summaries.push({
      slug: channel.slug,
      name: channel.name,
      count: channel.programmes.length,
    });
  }

  const today = bucharestDay(now);
  const firstDay = days[0] ?? null;
  const todaySlots = firstDay
    ? guide.channels.reduce(
        (sum, channel) => sum + programmesOn(channel, today).length,
        0,
      )
    : 0;

  return (
    <PageShell>
      <>
        <PageHero
          eyebrow="Ghid TV interactiv"
          title="Ghidul de programe, canal cu canal"
          lead={
            <>
              Alege un canal din listă și vezi programul lui, zi cu zi. Ghidul
              este citit de pe server la fiecare cerere, așa că nu este o
              fotografie veche: ce vezi aici este ce s-a publicat acum.
            </>
          }
          meta={
            <>
              <span>{guide.channels.length} canale în ghid</span>
              <span aria-hidden className="text-ink-faint/50">
                ·
              </span>
              <span>
                {guide.channels.reduce(
                  (sum, channel) => sum + channel.programmes.length,
                  0,
                )}{" "}
                emisiuni
              </span>
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
            <Stat label="Canale" value={guide.channels.length} />
            <Stat
              label="Zile publicate"
              value={days.length}
              hint={days.length > 1 ? "Ghidul se rotește." : "O singură zi."}
            />
            <Stat
              label="Emisiuni azi"
              value={todaySlots}
              hint={firstDay ? firstDay.label : undefined}
            />
            <Stat
              label="În catalog"
              value={channels.length}
              hint="Cu tot cu canalele fără ghid."
            />
          </div>
        </PageHero>

        <PageSection className="py-12 sm:py-16">
          {guide.channels.length === 0 ? (
            <Note title="Ghidul nu este disponibil" tone="signal">
              <p>
                Fișierul ghidului nu a putut fi citit, așa că pagina nu are ce
                arăta. Nu afișăm un program inventat: pagina se reîncarcă la
                fiecare cerere și va afișa ghidul imediat ce este disponibil.
              </p>
            </Note>
          ) : (
            <GuideExplorer
              channels={summaries}
              slots={slots}
              days={ranges}
              catalogue={catalogue}
              initialChannel={slug}
              initialDay={day}
              serverNow={now}
            />
          )}
        </PageSection>

        <PageSection className="pb-12 sm:pb-16">
          <Note title="Cum se construiește ghidul">
            <p>
              Programul fiecărui canal este citit dintr-un fișier produs în afara
              aplicației, în ora României. Cele mai multe canale au un program
              complet pentru ziua de azi; primele ore ale zilei următoare apar
              în fișier pe măsură ce se apropie de miezul nopții.
            </p>
            <p className="mt-3">
              Unele canale din catalog nu au deloc program publicat. Ele rămân
              în listă, dar fără sloturi — pentru că un canal fără ghid este tot
              un canal pe care poți deschide playerul.
            </p>
          </Note>
        </PageSection>

        <PageSection className="pb-16 sm:pb-20">
          <LinkRow
            label="Mergi mai departe"
            links={[
              { label: "Ce rulează acum", href: "/azi" },
              { label: "Program de mâine", href: "/maine" },
              { label: "Programul săptămânii", href: "/saptamana" },
              { label: "Caută o emisiune", href: "/cauta-o-emisiune" },
              { label: "Meciuri live la TV", href: "/meciuri" },
              { label: "Cum se folosește ghidul", href: "/ghid-tv" },
            ]}
          />
        </PageSection>
      </>
    </PageShell>
  );
}
