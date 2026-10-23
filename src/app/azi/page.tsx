import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";

export const dynamic = "force-dynamic";


import {
  LinkRow,
  Note,
  PageHero,
  PageSection,
  Stat,
} from "@/components/pages/blocks";
import { ScheduleRow, rowChannel } from "@/components/pages/schedule-row";
import { PageShell } from "@/components/pages/shell";
import { CHANNELS } from "@/data/channels";
import { toPublicChannels } from "@/lib/catalogue";
import { formatClock } from "@/components/now-next";
import {
  bucharestDay,
  channelSchedules,
  dayLabel,
  getGuide,
  requestMoment,
} from "@/lib/guide-pages";
import { getSecondaryMeta } from "@/lib/secondary";
import { SITE_NAME, SITE_PROMISE_SHORT } from "@/lib/site";

/**
 * What is on today.
 *
 * The page is rendered per request: "now" is a property of the request,
 * not of the component, and a page that caches it would start lying within
 * the hour.
 */


export const metadata: Metadata = {
  title: "Ce rulează acum",
  description:
    `Programul de azi, canal cu canal: ce rulează în acest moment, până când și ce urmează. Ghid TV ${SITE_PROMISE_SHORT.toLowerCase()}.`,
};

const HORIZON_MS = 3 * 60 * 60 * 1000;

export default async function Azi() {
  // connection() omitted for static export

  const now = requestMoment();
  const meta = await getSecondaryMeta();
  const channels = toPublicChannels(CHANNELS, meta);
  const guide = await getGuide();

  const entries = channelSchedules(guide, channels, now);
  const onAir = entries.filter((entry) => entry.now !== null);
  const covered = new Set(entries.map((entry) => entry.channel.id)).size;

  // What starts in the next three hours, across every channel the guide
  // covers — the answer to "ce urmează".
  const upcoming = entries
    .flatMap((entry) =>
      entry.guide.programmes
        .filter(
          (programme) =>
            programme.start > now && programme.start <= now + HORIZON_MS,
        )
        .map((programme) => ({ entry, programme })),
    )
    .sort((a, b) => a.programme.start - b.programme.start);

  const today = bucharestDay(now);

  return (
    <PageShell>
      <>
        <PageHero
          eyebrow="Program TV · azi"
          title={`Ce rulează acum pe canalele ${SITE_NAME}`}
          lead={
            <>
              Ghidul de programe al canalelor, citit în timp real. Fiecare canal
              arată ce rulează în acest moment, până la ce oră ține și ce urmează
              după el.
            </>
          }
          meta={
            <>
              <span className="font-mono text-[12px] tabular-nums text-ink-muted">
                {formatClock(now)}
              </span>
              <span aria-hidden className="text-ink-faint/50">
                ·
              </span>
              <span className="capitalize">{dayLabel(today)}</span>
              <span aria-hidden className="text-ink-faint/50">
                ·
              </span>
              <span>
                {onAir.length} din {covered} canale acoperite de ghid sunt în aer
              </span>
            </>
          }
        >
          <div className="grid max-w-3xl grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="În aer acum" value={onAir.length} />
            <Stat
              label="Emisiuni azi"
              value={guide.date === today ? "ziua completă" : "ziua ghidului"}
              hint={
                guide.date === today
                  ? "Ghidul acoperă toate orele zilei."
                  : undefined
              }
            />
            <Stat
              label="Următoarele 3 ore"
              value={upcoming.length}
              hint="Emisiuni care încep în continuare."
            />
            <Stat
              label="Canale în catalog"
              value={channels.length}
              hint="Verificate unul cu unul."
            />
          </div>
        </PageHero>

        <PageSection
          className="py-12 sm:py-16"
          eyebrow="În aer acum"
          title="Ce rulează pe fiecare canal"
          lead="Ordonat alfabetic. Apasă pe un canal ca să-l deschizi pe pagina lui, unde se află playerul."
        >
          {onAir.length === 0 ? (
            <Note title="Nimic în aer">
              Ghidul nu are niciun canal cu o emisiune în desfășurare la ora
              aceasta. Poate că fișierul ghidului nu a fost reîmprospătat; pagina
              se reîncarcă la fiecare cerere, deci următoarea încercare vede
              starea nouă.
            </Note>
          ) : (
            <div className="border-t border-white/[0.055]">
              {onAir.map((entry) => (
                <ScheduleRow
                  key={entry.channel.id}
                  channel={rowChannel(entry.channel)}
                  now={entry.now}
                  next={entry.next}
                  progress={entry.progress}
                  endsIn={entry.endsIn}
                />
              ))}
            </div>
          )}
        </PageSection>

        <PageSection
          className="pb-12 sm:pb-16"
          eyebrow="În continuare"
          title="Ce urmează în următoarele trei ore"
          lead="Toate emisiunile care încep în interval, pe toate canalele pe care ghidul le acoperă."
        >
          {upcoming.length === 0 ? (
            <Note title="Nimic programat">
              Ghidul nu mai are emisiuni cu începere în următoarele trei ore.
            </Note>
          ) : (
            <ol className="divide-y divide-white/[0.055] border-y border-white/[0.055]">
              {upcoming.map(({ entry, programme }, index) => (
                <li
                  key={`${entry.channel.id}-${programme.start}-${index}`}
                  className="flex flex-wrap items-baseline gap-x-4 gap-y-1 py-3"
                >
                  <span className="font-mono text-[12px] tabular-nums text-signal/85">
                    {formatClock(programme.start)}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[13.5px] text-ink">
                    {programme.title}
                  </span>
                  <Link
                    href={`/canal/${entry.channel.id}`}
                    className="text-[11.5px] uppercase tracking-[0.12em] text-ink-faint transition-colors duration-300 hover:text-ink"
                  >
                    {entry.channel.name}
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </PageSection>

        <PageSection className="pb-16 sm:pb-20">
          <Note title="Despre ghid" tone="quiet">
            <p>
              Ghidul este un fișier produs în afara aplicației și reprezintă o
              singură zi care se rotește. Când se rotește, pagina de azi arată
              automat noua zi, iar{" "}
              <Link href="/ghid" className="text-signal-bright underline underline-offset-4">
                ghidul interactiv
              </Link>{" "}
              arată ce acoperă el în acel moment.
            </p>
          </Note>
          <LinkRow
            className="mt-6"
            label="Mergi mai departe"
            links={[
              { label: "Ghid TV interactiv", href: "/ghid" },
              { label: "Program de mâine", href: "/maine" },
              { label: "Programul săptămânii", href: "/saptamana" },
              { label: "Caută o emisiune", href: "/cauta-o-emisiune" },
              { label: "Meciuri live la TV", href: "/meciuri" },
            ]}
          />
        </PageSection>
      </>
    </PageShell>
  );
}
