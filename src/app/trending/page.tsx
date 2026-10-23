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
import { ChannelTile, tileChannel } from "@/components/pages/channel-tile";
import { PageShell } from "@/components/pages/shell";
import { CHANNELS } from "@/data/channels";
import { toPublicChannels } from "@/lib/catalogue";
import { formatClock } from "@/components/now-next";
import { matchGuideChannels, resolveSchedule } from "@/components/now-next";
import { liveAudienceMap } from "@/lib/audience";
import { byTrending } from "@/lib/popularity";
import { getGuide, requestMoment } from "@/lib/guide-pages";
import { formatViewers } from "@/lib/utils";
import { getSecondaryMeta } from "@/lib/secondary";
import { SITE_NAME } from "@/lib/site";

/**
 * The channels people are watching now.
 *
 * Two signals, never mixed: our own audience, counted at the proxy, and the
 * catalogue's cumulative popularity counter. The first is a crowd; the
 * second is a ranking. Each is labelled with its own mark.
 */


export const metadata: Metadata = {
  title: "Top canale live acum",
  description:
    `Canalele cele mai urmărite pe ${SITE_NAME} în acest moment, cu numărul de spectatori măsurat la proxy.`,
};

export default async function Trending() {
  // connection() omitted for static export

  const now = requestMoment();
  const meta = await getSecondaryMeta();
  const channels = toPublicChannels(CHANNELS, meta);
  const live = liveAudienceMap();
  const guide = await getGuide();

  const matched = matchGuideChannels(guide, channels);
  const showing = new Map<string, { title: string; until: string } | null>();
  for (const [id, guideChannel] of matched) {
    const schedule = resolveSchedule(guideChannel, now);
    showing.set(
      id,
      schedule.now
        ? {
            title: schedule.now.title,
            until: formatClock(schedule.now.end),
          }
        : null,
    );
  }

  // The order: the crowd first, then the ranking, then the name — so the
  // list does not reshuffle itself between two renders.
  const pool = channels.filter(
    (channel) => channel.status === "live" || (channel.views ?? 0) > 0,
  );
  const ranked = [...(pool.length > 0 ? pool : channels)].sort((a, b) =>
    byTrending(a, b, live),
  );

  const totalAudience = Object.values(live).reduce((sum, n) => sum + n, 0);
  const measured = Object.keys(live).length;

  return (
    <PageShell>
      <>
        <PageHero
          eyebrow="În direct"
          title="Top canale live acum"
          lead={
            <>
              Ordinea este locul unde se adună oamenii: mai întâi câte browsere
              se uită acum la un canal, aici la {SITE_NAME}, apoi contorul de
              popularitate publicat de catalog. Cele două numere nu se
              amestecă niciodată.
            </>
          }
          meta={
            <>
              <span>{ranked.length} canale în clasament</span>
              <span aria-hidden className="text-ink-faint/50">
                ·
              </span>
              <span>
                {totalAudience > 0
                  ? `${formatViewers(totalAudience)} în față acum`
                  : "niciun spectator măsurat încă"}
              </span>
            </>
          }
        >
          <div className="grid max-w-3xl grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="În față acum" value={formatViewers(totalAudience)} />
            <Stat label="Canale măsurate" value={measured} />
            <Stat label="În clasament" value={ranked.length} />
            <Stat
              label="Ce rulează acum"
              value={formatClock(now)}
              hint="Ora României."
            />
          </div>
        </PageHero>

        <PageSection className="py-12 sm:py-16">
          <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {ranked.map((channel, index) => {
              const viewers = live[channel.id] ?? 0;
              const popularity = channel.views ?? 0;
              const current = showing.get(channel.id) ?? null;
              return (
                <li key={channel.id} className="relative">
                  <ChannelTile
                    channel={tileChannel(channel)}
                    now={current?.title ?? null}
                    until={current?.until ?? null}
                  />
                  <p className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 pl-1 text-[11px] text-ink-faint">
                    <span className="font-mono tabular-nums text-ink-faint/70">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    {viewers > 0 ? (
                      <>
                        <span className="relative size-1.5 rounded-full bg-live" />
                        <span className="text-ink-muted">
                          {formatViewers(viewers)} în față acum
                        </span>
                      </>
                    ) : popularity > 0 ? (
                      <span>
                        {formatViewers(popularity)} în clasamentul catalogului
                      </span>
                    ) : (
                      <span>Canal live, fără spectatori măsurați</span>
                    )}
                  </p>
                </li>
              );
            })}
          </ol>
        </PageSection>
        <PageSection className="pb-12 sm:pb-16">
          <Note title="Cele două numere">
            <p>
              <strong className="font-semibold text-ink">În față acum</strong>{" "}
              este numărul de browsere distincte care cer un segment de la un
              canal în ultimele nouăzeci de secunde, măsurat la proxy-ul nostru.
              Este o măsurătoare aici, la {SITE_NAME}, și se mișcă în timp real.
            </p>
            <p className="mt-3">
              <strong className="font-semibold text-ink">
                În clasamentul catalogului
              </strong>{" "}
              este contorul cumulativ publicat de directorul de la care
              indexăm canalele. Nu este o audiență: este un clasament, și de
              aceea este etichetat diferit. Nu este un clasament de audiență
              măsurată de un operator de telecablat.
            </p>
            <p className="mt-3">
              Când nu avem măsurătoare proprie pentru un canal, folosim
              contorul de popularitate — și spunem că asta este.
            </p>
          </Note>
        </PageSection>

        <PageSection className="pb-16 sm:pb-20">
          <LinkRow
            label="Mergi mai departe"
            links={[
              { label: "Toate canalele", href: "/canale/grupate" },
              { label: "Ce rulează acum", href: "/azi" },
              { label: "Top emisiuni", href: "/top-emisiuni" },
              { label: "Ghid TV interactiv", href: "/ghid" },
            ]}
          />
        </PageSection>
      </>
    </PageShell>
  );
}
