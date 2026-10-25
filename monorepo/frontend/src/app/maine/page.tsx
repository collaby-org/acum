import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
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
  guideDays,
  programmesOn,
  requestMoment,
  shiftDay,
} from "@/lib/guide-pages";
import { getSecondaryMeta } from "@/lib/secondary";
import { SITE_NAME, SITE_PROMISE_SHORT } from "@/lib/site";

/**
 * What is on tomorrow.
 *
 * The guide is a rolling window: it publishes one day that moves forward as
 * the day goes by. What it holds tomorrow is read off the file, not
 * assumed — if tomorrow is not there, the page says so instead of
 * republishing today under a different name.
 */

export const instant = false;

export const metadata: Metadata = {
  title: "Program de mâine",
  description:
    `Programul TV de mâine, canal cu canal. Ghidul de programe al ${SITE_NAME}, ${SITE_PROMISE_SHORT.toLowerCase()}.`,
};

export default async function Maine() {
  await connection();

  const now = requestMoment();
  const meta = await getSecondaryMeta();
  const channels = toPublicChannels(CHANNELS, meta);
  const guide = await getGuide();

  const today = bucharestDay(now);
  const tomorrow = shiftDay(today, 1);
  const days = guideDays(guide, now);
  const day = days.find((entry) => entry.date === tomorrow) ?? null;

  // The rows: every channel the guide knows, with tomorrow's slots on it.
  const entries = channelSchedules(guide, channels, now).map((entry) => {
    const slots = programmesOn(entry.guide, tomorrow);
    return { ...entry, day: slots };
  });
  const withSlots = entries.filter((entry) => entry.day.length > 0);

  return (
    <PageShell>
      <>
        <PageHero
          eyebrow="Program TV · mâine"
          title="Ce va rulea mâine"
          lead={
            <>
              Ghidul de programe este o singură zi care se rotește. Pagina de
              față arată exact ce a fost publicat pentru mâine — și, când
              programul nu este încă complet, spune până unde ajunge.
            </>
          }
          meta={
            <>
              <span className="capitalize">{dayLabel(tomorrow)}</span>
              {day ? (
                <>
                  <span aria-hidden className="text-ink-faint/50">
                    ·
                  </span>
                  <span>
                    {formatClock(day.first)} — {formatClock(day.last)} ·{" "}
                    {day.programmes} emisiuni pe {day.channels} canale
                  </span>
                </>
              ) : (
                <>
                  <span aria-hidden className="text-ink-faint/50">
                    ·
                  </span>
                  <span>nu este publicat încă</span>
                </>
              )}
            </>
          }
        >
          {day ? (
            <div className="grid max-w-3xl grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat
                label="Ziua"
                value={
                  <span className="capitalize">{day.weekday}</span>
                }
                hint={day.label}
              />
              <Stat label="Canale" value={day.channels} />
              <Stat label="Emisiuni" value={day.programmes} />
              <Stat
                label="Acoperire"
                value={`${formatClock(day.first)}–${formatClock(day.last)}`}
                hint="Orele publicate pentru mâine."
              />
            </div>
          ) : null}
        </PageHero>

        <PageSection className="py-12 sm:py-16">
          {day ? (
            <>
              <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-signal/85">
                    Programul zilei
                  </p>
                  <h2 className="mt-1.5 font-display text-xl font-semibold tracking-[-0.015em] text-ink sm:text-[26px]">
                    {day.channels} canale, canal cu canal
                  </h2>
                </div>
                <p className="text-xs text-ink-faint">
                  Orele sunt ora României.
                </p>
              </div>

              <div className="border-t border-white/[0.055]">
                {withSlots.map((entry) => (
                  <ScheduleRow
                    key={entry.channel.id}
                    channel={rowChannel(entry.channel)}
                    now={null}
                    next={[]}
                    progress={0}
                    endsIn={null}
                    day={entry.day}
                  />
                ))}
              </div>
            </>
          ) : (
            <Note title="Mâine nu este încă publicat" tone="signal">
              <p>
                Ghidul de programe acoperă{" "}
                <strong className="font-semibold text-ink">
                  {days.length > 0
                    ? days.map((entry) => entry.label).join(", ")
                    : "nicio zi"}
                </strong>
                . Pentru mâine nu există încă un program publicat, așa că nu îl
                arătăm aici — ar fi o zi de azi cu alt nume.
              </p>
              <p className="mt-3">
                Poți vedea ce rulează acum pe{" "}
                <Link href="/azi" className="text-signal-bright underline underline-offset-4">
                  pagina de azi
                </Link>{" "}
                sau poți deschide canalele din{" "}
                <Link href="/ghid" className="text-signal-bright underline underline-offset-4">
                  ghidul interactiv
                </Link>
                , unde se vede tot ce ghidul acoperă în acest moment.
              </p>
            </Note>
          )}
        </PageSection>

        {day ? (
          <PageSection className="pb-12 sm:pb-16">
            <Note title="Cât de departe ajunge ghidul">
              <p>
                Sursa publică un program care se rulează continuu: când o zi se
                apropie de final, primele ore ale zilei următoaretoare apar în
                fișier. De aceea mâine este acoperit{" "}
                <strong className="font-semibold text-ink">
                  până la {formatClock(day.last)}
                </strong>
                , iar după acea oră nu mai știm nimic. Pagina se reîncarcă la
                fiecare cerere, deci ce apare aici este întotdeauna ultima
                versiune publicată.
              </p>
            </Note>
          </PageSection>
        ) : null}

        <PageSection className="pb-16 sm:pb-20">
          <LinkRow
            label="Mergi mai departe"
            links={[
              { label: "Ce rulează acum", href: "/azi" },
              { label: "Programul săptămânii", href: "/saptamana" },
              { label: "Ghid TV interactiv", href: "/ghid" },
              { label: "Caută o emisiune", href: "/cauta-o-emisiune" },
            ]}
          />
        </PageSection>
      </>
    </PageShell>
  );
}
