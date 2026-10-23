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
import { PageShell } from "@/components/pages/shell";
import { CHANNELS } from "@/data/channels";
import { toPublicChannels } from "@/lib/catalogue";
import { formatClock } from "@/components/now-next";
import { matchGuideChannels } from "@/components/now-next";
import {
  bucharestDay,
  dayLabel,
  findLiveSport,
  findMatches,
  getGuide,
  requestMoment,
  sportsInGuide,
  type Match,
} from "@/lib/guide-pages";
import { getSecondaryMeta } from "@/lib/secondary";
import { plural } from "@/lib/utils";
import { SITE_NAME, SITE_PROMISE_SHORT } from "@/lib/site";

/**
 * The live matches.
 *
 * The guide carries no sport metadata: a slot is a title, a time and a
 * channel. A match is therefore recognised from the title — two sides
 * separated by a dash, on a sports channel — and the rule is written on the
 * page, so nobody has to guess why a fixture is or is not in the list.
 */


export const metadata: Metadata = {
  title: "Meciuri live la TV",
  description:
    `Meciurile și competițiile live din ghidul TV al ${SITE_NAME}: cine joacă, pe ce canal și la ce oră. ${SITE_PROMISE_SHORT}.`,
};

export default async function Meciuri() {
  // connection() omitted for static export

  const now = requestMoment();
  const meta = await getSecondaryMeta();
  const channels = toPublicChannels(CHANNELS, meta);
  const guide = await getGuide();

  const matches = findMatches(guide, now);
  const live = findLiveSport(guide, now);
  const sports = sportsInGuide(guide);

  // The catalogue id behind each guide channel, so a match can be linked.
  const catalogueBySlug = new Map<string, string>();
  for (const [id, guideChannel] of matchGuideChannels(guide, channels)) {
    catalogueBySlug.set(guideChannel.slug, id);
  }

  const onNow = matches.filter((match) => match.onNow);
  const rest = matches.filter((match) => !match.onNow);
  const today = bucharestDay(now);

  return (
    <PageShell>
      <>
        <PageHero
          eyebrow="Sport · live"
          title="Meciuri live la TV"
          lead={
            <>
              Ghidul nu are o secțiune de sport: un meci este recunoscut după
              titlu, când acesta numează două echipe pe un canal de sport. Tot ce
              este găsit aici este în ghid — nimic nu este completat din memorie.
            </>
          }
          meta={
            <>
              <span>
                {matches.length} meciuri în ghid
                {live.length > 0 ? ` · ${live.length} transmisii live` : ""}
              </span>
              <span aria-hidden className="text-ink-faint/50">
                ·
              </span>
              <span className="capitalize">{dayLabel(today)}</span>
            </>
          }
        >
          <div className="grid max-w-3xl grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Meciuri găsite" value={matches.length} />
            <Stat label="În aer acum" value={onNow.length} />
            <Stat label="Transmisii live" value={live.length} />
            <Stat
              label="Sporturi în ghid"
              value={sports.length}
              hint={sports.join(", ") || "Niciunul"}
            />
          </div>
        </PageHero>

        <PageSection className="py-12 sm:py-16">
          {matches.length === 0 ? (
            <Note title="Niciun meci în ghid" tone="signal">
              <p>
                Ghidul nu conține, în acest moment, niciun meci care să poată fi
                recunoscut ca atare — adică două echipe numite în titlu, pe un
                canal de sport. Nu construim o agendă de meciuri din memoria
                noastră: o afișăm pe cea care este publicată.
              </p>
              <p className="mt-3">
                Competițiile live care nu au două echipe în titlu sunt mai
                jos, iar pagina se reîncarcă la fiecare cerere.
              </p>
            </Note>
          ) : (
            <div className="space-y-12">
              {onNow.length > 0 ? (
                <MatchGroup
                  eyebrow="În aer acum"
                  title={`${onNow.length} ${plural(onNow.length, "meci rulează", "meciuri rulează", "de meciuri rulează")}`}
                  matches={onNow}
                  catalogueBySlug={catalogueBySlug}
                />
              ) : null}

              <MatchGroup
                eyebrow={onNow.length > 0 ? "Următorii" : "Programul meciurilor"}
                title={
                  onNow.length > 0
                    ? "Meciurile care urmează în ghid"
                    : "Meciurile din ghid"
                }
                matches={rest}
                catalogueBySlug={catalogueBySlug}
              />
            </div>
          )}
        </PageSection>

        {live.length > 0 ? (
          <PageSection
            className="pb-12 sm:pb-16"
            eyebrow="În plus"
            title="Competiții live, fără două echipe în titlu"
            lead="Transmisiuni și turnee aflate în aer sau anunțate ca live, pe care titlul nu le poate clasifica drept meciuri."
          >
            <ol className="divide-y divide-white/[0.055] border-y border-white/[0.055]">
              {live.map((entry, index) => (
                <li
                  key={`${entry.channel.slug}-${entry.programme.start}-${index}`}
                  className="flex flex-wrap items-baseline gap-x-4 gap-y-1 py-3"
                >
                  <span className="font-mono text-[12px] tabular-nums text-signal/85">
                    {formatClock(entry.programme.start)}
                  </span>
                  {entry.onNow ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-live/12 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em] text-live-soft">
                      <span aria-hidden className="size-1.5 rounded-full bg-live" />
                      Acum
                    </span>
                  ) : null}
                  <span className="min-w-0 flex-1 text-[13.5px] text-ink">
                    {entry.programme.title}
                  </span>
                  <span className="shrink-0 text-[11.5px] uppercase tracking-[0.12em] text-ink-faint">
                    {entry.channel.name}
                  </span>
                </li>
              ))}
            </ol>
          </PageSection>
        ) : null}

        <PageSection className="pb-12 sm:pb-16">
          <Note title="Cum recunoaștem un meci">
            <p>
              Ghidul de programe nu are câmpuri de sport. Un meci este recunoscut
              după titlu, când titlul numește două echipe separate printr-o
              linie de fracție, pe un canal al cărui nume conține „sport”,
              „arena” sau o competiție. Echipele se citesc înainte și după linie,
              iar runda de la final — „Etapa 3”, „Turul 2” — este scoasă înainte
              de împărțire.
            </p>
            <p className="mt-3">
              {sports.length > 0 ? (
                <>
                  În ghid se găsesc acum{" "}
                  <strong className="font-semibold text-ink">
                    {sports.join(", ")}
                  </strong>
                  .{" "}
                </>
              ) : (
                <>Ghidul nu conține, acum, niciun sport. </>
              )}
              {sports.includes("Rugby")
                ? "Meciurile de rugby sunt în listă, recunoscute după aceeași regulă."
                : "Nu găsim meciuri de rugby în ghidul de azi, așa că nu le listăm. Dacă apar, vor fi aici automat, pentru că regula nu depinde de competiție."}
            </p>
          </Note>
        </PageSection>

        <PageSection className="pb-16 sm:pb-20">
          <LinkRow
            label="Mergi mai departe"
            links={[
              { label: "Ce rulează acum", href: "/azi" },
              { label: "Ghid TV interactiv", href: "/ghid" },
              { label: "Program de mâine", href: "/maine" },
              { label: "Toate canalele", href: "/canale/grupate" },
            ]}
          />
        </PageSection>
      </>
    </PageShell>
  );
}

/**
 * A group of matches: the ones on air now, and the ones that follow.
 *
 * The card is a link to the channel when the guide channel is one the
 * catalogue knows, and a plain panel when it is not.
 */
function MatchGroup({
  eyebrow,
  title,
  matches,
  catalogueBySlug,
}: {
  eyebrow: string;
  title: string;
  matches: Match[];
  catalogueBySlug: Map<string, string>;
}) {
  if (matches.length === 0) return null;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-signal/85">
            {eyebrow}
          </p>
          <h2 className="mt-1.5 font-display text-xl font-semibold tracking-[-0.015em] text-ink sm:text-[26px]">
            {title}
          </h2>
        </div>
        <p className="text-xs text-ink-faint">Orele sunt ora României.</p>
      </div>

      <ul className="grid gap-3 lg:grid-cols-2">
        {matches.map((match, index) => {
          const channelId = catalogueBySlug.get(match.channel.slug);
          const body = (
            <>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                <span className="font-mono text-[12px] tabular-nums text-signal/90">
                  {formatClock(match.programme.start)}
                </span>
                {match.onNow ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-live/12 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em] text-live-soft">
                    <span aria-hidden className="size-1.5 rounded-full bg-live" />
                    Acum
                  </span>
                ) : null}
                {match.competition ? (
                  <span className="truncate text-[10.5px] uppercase tracking-[0.14em] text-ink-faint">
                    {match.competition}
                  </span>
                ) : null}
              </div>

              <p className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 font-display text-[16px] font-semibold leading-tight tracking-tight text-ink">
                <span className="min-w-0">{match.home}</span>
                <span aria-hidden className="text-ink-faint">
                  —
                </span>
                <span className="min-w-0">{match.away}</span>
              </p>

              <p className="mt-2 text-[11.5px] uppercase tracking-[0.12em] text-ink-faint">
                {match.channel.name}
                {channelId ? " · deschide canalul" : ""}
              </p>
            </>
          );

          return (
            <li key={`${match.channel.slug}-${match.programme.start}-${index}`}>
              {channelId ? (
                <Link
                  href={`/canal/${channelId}`}
                  className="group block h-full rounded-[var(--radius-panel)] border border-white/[0.07] bg-white/[0.03] p-5 transition-[transform,border-color,background-color,box-shadow] duration-[420ms] ease-spring hover:-translate-y-1 hover:border-white/16 hover:bg-white/[0.055] hover:shadow-[var(--shadow-e3)] motion-reduce:transform-none"
                >
                  {body}
                </Link>
              ) : (
                <div className="h-full rounded-[var(--radius-panel)] border border-white/[0.07] bg-white/[0.03] p-5">
                  {body}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
