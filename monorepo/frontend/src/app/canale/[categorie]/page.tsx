import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import Link from "next/link";
import {
  LinkRow,
  Note,
  PageHero,
  PageSection,
  Stat,
} from "@/components/pages/blocks";
import { CategoryNav, resolveCategory } from "@/components/pages/categories";
import { ChannelTile, tileChannel } from "@/components/pages/channel-tile";
import { PageShell } from "@/components/pages/shell";
import { CHANNELS, CATEGORIES } from "@/data/channels";
import { toPublicChannels } from "@/lib/catalogue";
import { formatClock } from "@/components/now-next";
import { matchGuideChannels, resolveSchedule } from "@/components/now-next";
import { getGuide, requestMoment } from "@/lib/guide-pages";
import { getSecondaryMeta } from "@/lib/secondary";
import { SITE_NAME } from "@/lib/site";

/**
 * One category.
 *
 * The category is resolved from the slug by the shared table, so the page
 * answers to both the catalogue's own name („movies”) and the Romanian one
 * („filme”, „divertisment”).
 */

export const instant = false;

type Props = {
  params: Promise<{ categorie: string }>;
};

export async function generateMetadata({
  params,
}: Props): Promise<Metadata> {
  const { categorie } = await params;
  const resolved = resolveCategory(categorie);
  if (!resolved) return { title: "Categorie" };

  const category = CATEGORIES.find((entry) => entry.id === resolved.id);
  const label = category?.label ?? resolved.id;
  return {
    title: `${label} — canale TV live`,
    description:
      category?.tagline ??
      `Toate canalele din categoria ${label}, pe ${SITE_NAME}.`,
  };
}

export default async function Categorie({ params }: Props) {
  await connection();

  const { categorie } = await params;
  const resolved = resolveCategory(categorie);
  if (!resolved) notFound();

  const now = requestMoment();
  const meta = await getSecondaryMeta();
  const channels = toPublicChannels(CHANNELS, meta);
  const guide = await getGuide();

  const category = CATEGORIES.find((entry) => entry.id === resolved.id);
  const label = category?.label ?? resolved.id;
  const tagline = category?.tagline ?? "";

  const list = channels.filter((channel) => channel.category === resolved.id);
  const matched = matchGuideChannels(guide, list);
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

  const liveCount = list.filter((channel) => channel.status === "live").length;

  return (
    <PageShell>
      <>
        <PageHero
          eyebrow="Catalog · categorie"
          title={label}
          lead={
            tagline ? (
              <>
                {tagline}. {list.length} canale în această categorie, fiecare cu
                playerul lui și cu ce rulează acum.
              </>
            ) : (
              <>
                {list.length} canale în această categorie, fiecare cu playerul
                lui și cu ce rulează acum.
              </>
            )
          }
          meta={
            <>
              <span>{list.length} canale</span>
              <span aria-hidden className="text-ink-faint/50">
                ·
              </span>
              <span>{liveCount} pot fi deschise acum</span>
              <span aria-hidden className="text-ink-faint/50">
                ·
              </span>
              <span>{matched.size} au program publicat</span>
            </>
          }
        >
          <div className="grid max-w-3xl grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Canale" value={list.length} />
            <Stat label="Live acum" value={liveCount} />
            <Stat label="Cu ghid" value={matched.size} />
            <Stat
              label="Familii"
              value={new Set(list.map((channel) => channel.family)).size}
            />
          </div>
          <CategoryNav className="mt-8" current={resolved.id} />
        </PageHero>

        {resolved.alias !== resolved.id ? (
          <PageSection className="pt-10">
            <Note title="Despre această adresă">
              <p>
                Adresa{" "}
                <span className="font-mono text-[13px] text-ink">
                  /canale/{resolved.alias}
                </span>{" "}
                este un nume alternativ pentru categoria{" "}
                <strong className="font-semibold text-ink">{label}</strong>.{" "}
                {resolved.id === "movies"
                  ? "Catalogul nu are o categorie «Divertisment»: canalele de divertisment — Comedy Central, Shorts — stau la «Filme». Dacă vrei «Divertisment» drept categorie de sine, spune-ne și o adăugăm."
                  : "Ambele adrese duc la aceleași canale."}
              </p>
            </Note>
          </PageSection>
        ) : null}

        <PageSection className="py-12 sm:py-16">
          {list.length === 0 ? (
            <Note title="Categorie goală">
              <p>Nu există canale în această categorie.</p>
            </Note>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {list.map((channel) => {
                const current = showing.get(channel.id) ?? null;
                return (
                  <ChannelTile
                    key={channel.id}
                    channel={tileChannel(channel)}
                    now={current?.title ?? null}
                    until={current?.until ?? null}
                  />
                );
              })}
            </div>
          )}
        </PageSection>

        <PageSection className="pb-12 sm:pb-16">
          <Note title="Canalele din această categorie">
            <p>
              Fiecare canal este verificat înainte de a intra în catalog. Un
              canal care nu răspunde rămâne în listă, marcat ca indisponibil —
              uneori merge de acasă, unde verificarea noastră nu ajunge.
            </p>
            <p className="mt-3">
              Lipsesc canalele pe care nu le-am putut verifica. Dacă știi unul
              care merită,{" "}
              <Link
                href="/propune-un-canal"
                className="text-signal-bright underline underline-offset-4"
              >
                propune-l
              </Link>
              .
            </p>
          </Note>
        </PageSection>

        <PageSection className="pb-16 sm:pb-20">
          <LinkRow
            label="Mergi mai departe"
            links={[
              { label: "Toate canalele", href: "/canale/grupate" },
              { label: "Top canale live acum", href: "/trending" },
              { label: "Ce rulează acum", href: "/azi" },
              { label: "Ghid TV interactiv", href: "/ghid" },
            ]}
          />
        </PageSection>
      </>
    </PageShell>
  );
}
