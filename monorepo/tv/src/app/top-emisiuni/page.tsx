import type { Metadata } from "next";
import { connection } from "next/server";
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
import { liveAudienceMap } from "@/lib/audience";
import {
  bucharestDay,
  dayLabel,
  getGuide,
  rankProgrammes,
  requestMoment,
} from "@/lib/guide-pages";
import { formatViewers } from "@/lib/utils";
import { getSecondaryMeta } from "@/lib/secondary";
import { SITE_NAME } from "@/lib/site";

/**
 * The most-watched programmes.
 *
 * There is no vote and no ratings table. What there is: the guide, and the
 * audience of the channels that carry a programme. A title that several
 * channels air at once, on channels people watch, is the closest honest
 * thing to "most watched" the data supports — and the page says exactly
 * how it is built.
 */

export const instant = false;

export const metadata: Metadata = {
  title: "Top emisiuni",
  description:
    `Cele mai urmărite emisiuni din ghidul ${SITE_NAME}, clasament derivat din numărul de canale și din audiența canalelor.`,
};

export default async function TopEmisiuni() {
  await connection();

  const now = requestMoment();
  const meta = await getSecondaryMeta();
  const channels = toPublicChannels(CHANNELS, meta);
  const guide = await getGuide();
  const live = liveAudienceMap();

  // The two audience signals, keyed by the guide's own name for each
  // channel. Our own count is a crowd, measured here, right now. The
  // catalogue's popularity counter is a cumulative ranking. They are kept
  // apart and never added together.
  const liveByName: Record<string, number> = {};
  const popularByName: Record<string, number> = {};
  const measured = new Set<string>();
  for (const [id, guideChannel] of matchGuideChannels(guide, channels)) {
    const counted = live[id] ?? 0;
    const popular = channels.find((channel) => channel.id === id)?.views ?? 0;
    liveByName[guideChannel.name] = counted;
    popularByName[guideChannel.name] = popular;
    if (counted > 0) measured.add(guideChannel.name);
  }

  const ranked = rankProgrammes(guide, liveByName, popularByName, now);
  const top = ranked.slice(0, 24);
  const onNow = ranked.filter((entry) => entry.onNow).length;
  const today = bucharestDay(now);

  return (
    <PageShell>
      <>
        <PageHero
          eyebrow="Clasament · ghid"
          title="Cele mai urmărite emisiuni"
          lead={
            <>
              Clasamentul este construit din ghid și din măsurătorile noastre, nu
              din voturi: o emisiune urcă în top când o difuzează mai multe canale
              și când acele canale au oameni în față — sau, unde nu avem
              măsurătoare, când sunt bine cotate în catalogul de la care
              indexăm. Cum se calculează, mai jos.
            </>
          }
          meta={
            <>
              <span>{ranked.length} emisiuni distincte în ghid</span>
              <span aria-hidden className="text-ink-faint/50">
                ·
              </span>
              <span>{onNow} rulează în acest moment</span>
              <span aria-hidden className="text-ink-faint/50">
                ·
              </span>
              <span className="capitalize">{dayLabel(today)}</span>
            </>
          }
        >
          <div className="grid max-w-3xl grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Emisiuni clasate" value={ranked.length} />
            <Stat
              label="În aer acum"
              value={onNow}
              hint="Titluri afișate pe canalul lor chiar acum."
            />
            <Stat
              label="Măsurători proprii"
              value={measured.size}
              hint="Canale cu spectatori numărați la proxy."
            />
            <Stat
              label="Canale în ghid"
              value={guide.channels.length}
              hint="Sursa clasamentului."
            />
          </div>
        </PageHero>

        <PageSection className="py-12 sm:py-16">
          {top.length === 0 ? (
            <Note title="Clasament gol" tone="signal">
              <p>
                Ghidul nu conține nicio emisiune, deci nu există ce clasa. Pagina
                se reîncarcă la fiecare cerere.
              </p>
            </Note>
          ) : (
            <ol className="border-t border-white/[0.055]">
              {top.map((entry, index) => (
                <li
                  key={entry.title}
                  className="grid gap-x-5 gap-y-2 border-b border-white/[0.055] py-4 sm:grid-cols-[52px_minmax(0,1fr)_minmax(0,220px)] sm:items-baseline"
                >
                  <span className="font-mono text-[13px] tabular-nums text-ink-faint">
                    {String(index + 1).padStart(2, "0")}
                  </span>

                  <div className="min-w-0">
                    <p className="text-[14.5px] font-medium leading-snug text-ink">
                      {entry.title}
                    </p>
                    <p className="mt-1 truncate text-[11.5px] text-ink-faint">
                      {entry.channels.join(", ")}
                      {entry.channels.length > 4
                        ? ` +${entry.channels.length - 4}`
                        : ""}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 sm:justify-end">
                    {entry.onNow ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-live/12 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em] text-live-soft">
                        <span aria-hidden className="size-1.5 rounded-full bg-live" />
                        Acum
                      </span>
                    ) : (
                      <span className="font-mono text-[11px] tabular-nums text-ink-faint">
                        {formatClock(entry.startsAt)}
                      </span>
                    )}
                    <span className="text-[11.5px] text-ink-faint">
                      pe <span className="text-ink-muted">{entry.reach}</span>{" "}
                      {entry.reach === 1 ? "canal" : "canale"}
                    </span>
                    {entry.liveViewers > 0 ? (
                      <span className="text-[11.5px] text-ink-muted">
                        {formatViewers(entry.liveViewers)} în față acum
                      </span>
                    ) : null}
                    {entry.popularity > 0 ? (
                      <span className="text-[11.5px] text-ink-faint">
                        {formatViewers(entry.popularity)} în clasamentul
                        catalogului
                      </span>
                    ) : null}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </PageSection>

        <PageSection className="pb-12 sm:pb-16">
          <Note title="Cum se calculează acest clasament">
            <p>
              <strong className="font-semibold text-ink">Nu sunt voturi.</strong>{" "}
              Site-ul nu are un sistem de vot și nu primește un clasament de
              audiență de la un operator de măsurare. Ceea ce poate măsura în
              mod real este ghidul și oamenii care se uită acum la un canal.
            </p>
            <ol className="mt-4 list-decimal space-y-2 pl-5">
              <li>
                <strong className="font-semibold text-ink">Răspândirea.</strong>{" "}
                Numărul de canale distincte care difuzează același titlu. Un
                program pe zece canale se vede în toată țara; unul pe un singur
                canal nu.
              </li>
              <li>
                <strong className="font-semibold text-ink">Audiența.</strong>{" "}
                Spectatorii numărați la proxy pentru canalele care difuzează
                emisiunea. Acolo unde nu avem măsurătoare, folosim contorul de
                popularitate publicat de catalog — care este un clasament
                cumulativ, nu o audiență în direct, și este etichetat ca atare.
              </li>
              <li>
                <strong className="font-semibold text-ink">Momentul.</strong>{" "}
                Emisiunile care rulează în acest moment sunt înaintea celorlalte.
              </li>
            </ol>
            <p className="mt-4">
              Când canalele vor avea un sistem de vot — cu un buton pe pagina
              emisiunii — clasamentul se va schimba într-un clasament votat, cu
              numărul de voturi afișat alături.
            </p>
          </Note>
        </PageSection>

        <PageSection className="pb-16 sm:pb-20">
          <LinkRow
            label="Mergi mai departe"
            links={[
              { label: "Ce rulează acum", href: "/azi" },
              { label: "Ghid TV interactiv", href: "/ghid" },
              { label: "Programul săptămânii", href: "/saptamana" },
              { label: "Top canale live acum", href: "/trending" },
            ]}
          />
        </PageSection>
      </>
    </PageShell>
  );
}
