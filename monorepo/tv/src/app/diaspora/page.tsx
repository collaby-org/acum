import type { Metadata } from "next";
import { connection } from "next/server";
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
import { getGuide, requestMoment } from "@/lib/guide-pages";
import { getSecondaryMeta } from "@/lib/secondary";

/**
 * Television for the diaspora.
 *
 * The catalogue has no "diaspora" category, so this page is a selection made
 * by rule and the rule is written on the page: the channels that broadcast
 * in English, and the Romanian-language channels made for Romanians living
 * outside the country.
 */

export const instant = false;

export const metadata: Metadata = {
  title: "TV pentru diaspora",
  description:
    "Canalele de știri în engleză și canalele în limba română făcute pentru diaspora, adunate într-un singur loc.",
};

/** The selection, and the reason each group exists. */
const GROUPS = [
  {
    id: "english",
    title: "Știri în engleză",
    lead: "Canale care trimit informația în engleză, pentru cine urmărește știrile dincolo de granița lingvistică a României.",
    channels: [
      "bbc-world-news",
      "bbc-news",
      "bbc-first",
      "euronews",
      "cnn",
      "france-24",
      "antena-3-cnn",
    ],
  },
  {
    id: "romanian",
    title: "În limba română, pentru diaspora",
    lead: "Canale care vorbesc românește și se adresează celor care trăiesc departe de casă — inclusiv cele din Republica Moldova.",
    channels: [
      "tvr-internazionale",
      "trinitas-tv",
      "romania-tv",
      "moldova-1",
      "publika-tv",
    ],
  },
];

export default async function Diaspora() {
  await connection();

  const now = requestMoment();
  const meta = await getSecondaryMeta();
  const channels = toPublicChannels(CHANNELS, meta);
  const guide = await getGuide();

  const matched = matchGuideChannels(guide, channels);
  const byId = new Map(channels.map((channel) => [channel.id, channel]));

  // What is on the selected channels right now — when the guide knows them.
  const onNow = new Map<string, { title: string; until: string } | null>();
  for (const [id, guideChannel] of matched) {
    const schedule = resolveSchedule(guideChannel, now);
    onNow.set(
      id,
      schedule.now
        ? {
            title: schedule.now.title,
            until: formatClock(schedule.now.end),
          }
        : null,
    );
  }

  const groups = GROUPS.map((group) => ({
    ...group,
    list: group.channels
      .map((id) => byId.get(id))
      .filter((channel): channel is NonNullable<typeof channel> => Boolean(channel)),
  }));

  const total = groups.reduce((sum, group) => sum + group.list.length, 0);
  const withGuide = groups.reduce(
    (sum, group) =>
      sum +
      group.list.filter((channel) => matched.has(channel.id)).length,
    0,
  );
  const liveCount = groups.reduce(
    (sum, group) =>
      sum + group.list.filter((channel) => channel.status === "live").length,
    0,
  );

  return (
    <PageShell>
      <>
        <PageHero
          eyebrow="TV pentru diaspora"
          title="Știrile și canalele pentru cei de departe"
          lead={
            <>
              Pentru cine trăiește în altă țară și în altă limbă: știrile în
              engleză și canalele care continuă să vorbească românește. Selecția
              este făcută după numele canalelor, pentru că catalogul nu are o
              categorie „diaspora” — și este spus aici, nu ascunsă.
            </>
          }
          meta={
            <>
              <span>{total} canale selectate</span>
              <span aria-hidden className="text-ink-faint/50">
                ·
              </span>
              <span>{liveCount} pot fi deschise acum</span>
              <span aria-hidden className="text-ink-faint/50">
                ·
              </span>
              <span>{withGuide} au program publicat</span>
            </>
          }
        >
          <div className="grid max-w-3xl grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Canale" value={total} />
            <Stat label="Live acum" value={liveCount} />
            <Stat label="Cu program" value={withGuide} />
            <Stat
              label="Grupuri"
              value={groups.length}
              hint="Engleză și limba română."
            />
          </div>
        </PageHero>

        {groups.map((group) => (
          <PageSection
            key={group.id}
            className="pb-12 sm:pb-16"
            eyebrow={group.id === "english" ? "În engleză" : "În română"}
            title={group.title}
            lead={group.lead}
          >
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {group.list.map((channel) => {
                const showing = onNow.get(channel.id) ?? null;
                return (
                  <ChannelTile
                    key={channel.id}
                    channel={tileChannel(channel)}
                    now={showing?.title ?? null}
                    until={showing?.until ?? null}
                    note={
                      group.id === "english" ? "Știri în engleză" : "În limba română"
                    }
                  />
                );
              })}
            </div>
          </PageSection>
        ))}

        <PageSection className="pb-12 sm:pb-16">
          <Note title="Cum a fost făcută selecția">
            <p>
              Catalogul are șapte categorii — generaliste, știri, sport, filme,
              copii, documentare și muzică — și niciuna nu se cheamă „diaspora”.
              Pagina asta este, așadar, o selecție făcută după numele canalelor:
              cele care trimit știri în engleză și cele care se adresează
              românilor din afara țării.
            </p>
            <p className="mt-3">
              Nu este o categorie nouă, ascunsă în cod, și nu este o listă
              completă a canalelor de peste graniță — este ce putem spune azi,
              pe baza a ce știm. Canalele fără program publicat rămân în listă:
              playerul lor funcționează la fel de bine.
            </p>
            <p className="mt-3">
              Dacă vrei un canal care nu este aici, catalogul crește din
              surse verificate — un canal intră când cineva îl difuzează,
              nu când cineva îl cere.
            </p>
          </Note>
        </PageSection>

        <PageSection className="pb-16 sm:pb-20">
          <LinkRow
            label="Mergi mai departe"
            links={[
              { label: "Toate canalele", href: "/canale/grupate" },
              { label: "Știri", href: "/canale/stiri" },
              { label: "Ce rulează acum", href: "/azi" },
            ]}
          />
        </PageSection>
      </>
    </PageShell>
  );
}
