import type { Metadata } from "next";
import { connection } from "next/server";
import Link from "next/link";
import {
  LinkRow,
  Note,
  PageHero,
  PageSection,
  Stat,
} from "@/components/pages/blocks";
import { CategoryNav } from "@/components/pages/categories";
import { ChannelTile, tileChannel } from "@/components/pages/channel-tile";
import { PageShell } from "@/components/pages/shell";
import { CHANNELS, CATEGORIES } from "@/data/channels";
import { toPublicChannels } from "@/lib/catalogue";
import { formatClock } from "@/components/now-next";
import { matchGuideChannels, resolveSchedule } from "@/components/now-next";
import { getGuide, requestMoment } from "@/lib/guide-pages";
import { CATEGORY_LABELS, CATEGORY_ORDER } from "@/lib/navigation";
import { getSecondaryMeta } from "@/lib/secondary";
import { SITE_NAME } from "@/lib/site";
import { requireSignedIn } from "@/lib/session";

/**
 * Every channel, grouped by category.
 *
 * The card language is the app's: the same logo, the same name, the same
 * live mark — and, on top, what the guide says is on right now.
 *
 * The page lives at `/canale/grupate`. `/canale` is the catalogue itself —
 * the hero, the rails and the shelves — and the two are different surfaces:
 * this one is the list, the other is the product.
 */

export const instant = false;

export const metadata: Metadata = {
  title: "Toate canalele",
  description:
    `Toate canalele TV live din catalogul ${SITE_NAME}, grupate pe categorii: generaliste, știri, sport, filme, copii, documentare și muzică.`,
};

export default async function CanaleGrupate() {
  await connection();
  await requireSignedIn("/canale/grupate");

  const now = requestMoment();
  const meta = await getSecondaryMeta();
  const channels = toPublicChannels(CHANNELS, meta);
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

  const groups = CATEGORY_ORDER.map((id) => {
    const label =
      CATEGORY_LABELS[id] ??
      CATEGORIES.find((category) => category.id === id)?.label ??
      id;
    const tagline =
      CATEGORIES.find((category) => category.id === id)?.tagline ?? "";
    const list = channels.filter((channel) => channel.category === id);
    return { id, label, tagline, list };
  }).filter((group) => group.list.length > 0);

  const liveCount = channels.filter((channel) => channel.status === "live").length;
  const withGuide = matched.size;

  return (
    <PageShell>
      <>
        <PageHero
          eyebrow="Catalog"
          title="Toate canalele"
          lead={
            <>
              Canalele din catalog, grupate pe categorii. Fiecare canal deschide
              playerul pe pagina lui; acolo găsești și ce rulează în acel moment.
            </>
          }
          meta={
            <>
              <span>{channels.length} canale</span>
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
            <Stat label="Canale" value={channels.length} />
            <Stat label="Categorii" value={groups.length} />
            <Stat label="Live acum" value={liveCount} />
            <Stat label="Cu ghid" value={withGuide} />
          </div>
          <CategoryNav className="mt-8" />
        </PageHero>

        {groups.map((group) => (
          <PageSection
            key={group.id}
            id={group.id}
            className="scroll-mt-24 py-12 sm:py-16"
            eyebrow={group.tagline}
            title={group.label}
            aside={
              <Link
                href={`/canale/${group.id}`}
                className="text-[12px] uppercase tracking-[0.14em] text-ink-faint transition-colors duration-300 hover:text-ink"
              >
                Vezi categoria
              </Link>
            }
          >
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {group.list.map((channel) => {
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
          </PageSection>
        ))}

        <PageSection className="pb-12 sm:pb-16">
          <Note title="Despre catalog">
            <p>
              Fiecare canal este verificat înainte de a intra în listă: un canal
              care nu răspunde este marcat ca indisponibil, nu ascuns. Ce se
              schimbă în timp — popularitatea, spectatorii, ce rulează acum — este
              citit la fiecare cerere.
            </p>
            <p className="mt-3">
              Lipsesc canalele pe care nu le-am putut verifica sau pe care nimeni
              nu le mai difuzează. Un canal intră în listă când o sursă îl
              difuzează, nu când cineva îl cere.
            </p>
          </Note>
        </PageSection>

        <PageSection className="pb-16 sm:pb-20">
          <LinkRow
            label="Mergi mai departe"
            links={[
              { label: "Top canale live acum", href: "/trending" },
              { label: "Ce rulează acum", href: "/azi" },
              { label: "Ghid TV interactiv", href: "/ghid" },
              { label: "TV pentru diaspora", href: "/diaspora" },
            ]}
          />
        </PageSection>
      </>
    </PageShell>
  );
}
