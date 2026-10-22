"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { Compass, Heart, Radio, Sparkles } from "lucide-react";
import type { Category, Channel } from "@/data/types";
import type { EpgGuide } from "@/components/now-next";
import { Header } from "@/components/header";
import { Hero } from "@/components/hero";
import { ChannelRail } from "@/components/channel-rail";
import { ChannelCard } from "@/components/channel-card";
import { ChannelIndex } from "@/components/channel-index";
import { SearchPanel } from "@/components/search-panel";
import { ShelfRail } from "@/components/shelf-rail";
import { PlayerModal } from "@/components/player";
import { Button } from "@/components/ui/button";
import { useFavourites, useRecentlyWatched } from "@/hooks/use-favorites";
import { resolveShelf, useShelves } from "@/hooks/use-shelves";
import { celebrate, dismiss } from "@/lib/confetti";
import { byPlayability, isPlayable } from "@/lib/channel-meta";
import { CATEGORY_ORDER } from "@/lib/navigation";
import { plural } from "@/lib/utils";

type BrowseProps = {
  channels: Channel[];
  categories: Category[];
  /** Today's programme guide, prepared on the server. */
  guide?: EpgGuide | null;
};

type View = "home" | "favorites" | "recent";

export function Browse({ channels, categories, guide }: BrowseProps) {
  const [query, setQuery] = useState("");
  const [view, setView] = useState<View>("home");
  const [active, setActive] = useState<Channel | null>(null);
  const [playerOpen, setPlayerOpen] = useState(false);
  const favourites = useFavourites();
  const recent = useRecentlyWatched();
  const shelves = useShelves();
  const railRefs = useRef(new Map<string, HTMLElement>());

  const liveChannels = useMemo(
    () => channels.filter(isPlayable).sort(byPlayability),
    [channels],
  );

  const byCategory = useMemo(() => {
    const map = new Map<string, Channel[]>();
    for (const id of CATEGORY_ORDER) map.set(id, []);
    for (const channel of channels) map.get(channel.category)?.push(channel);
    for (const [key, list] of map) map.set(key, [...list].sort(byPlayability));
    return map;
  }, [channels]);

  const favouriteChannels = useMemo(
    () =>
      channels
        .filter((c) => favourites.ids.includes(c.id))
        .sort(byPlayability),
    [channels, favourites.ids],
  );

  const recentChannels = useMemo(
    () =>
      recent.ids
        .map((id) => channels.find((c) => c.id === id))
        .filter((c): c is Channel => Boolean(c)),
    [channels, recent.ids],
  );

  const openPlayer = useCallback((channel: Channel) => {
    setActive(channel);
    setPlayerOpen(true);
    recent.remember(channel.id);
  }, [recent]);

  const toggleFavourite = useCallback(
    (channel: Channel, event?: React.MouseEvent<HTMLButtonElement>) => {
      const origin = event
        ? { x: event.clientX / window.innerWidth, y: event.clientY / window.innerHeight }
        : undefined;
      if (favourites.set.toggle(channel.id)) celebrate(channel, origin);
      else dismiss(channel, origin);
    },
    [favourites.set],
  );

  const isFavourite = useCallback(
    (id: string) => favourites.ids.includes(id),
    [favourites.ids],
  );

  const searching = query.trim().length > 0;

  const jumpTo = useCallback((channel: Channel) => {
    const node = railRefs.current.get(channel.category);
    node?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  return (
    <div id="top" className="min-h-screen">
      <Header
        query={query}
        onQueryChange={(value) => {
          setQuery(value);
          if (value.trim()) setView("home");
        }}
        favoritesCount={favourites.ids.length}
        favoritesActive={view === "favorites"}
        onToggleFavorites={() =>
          setView((v) => (v === "favorites" ? "home" : "favorites"))
        }
      />

      <main>
        {/* ---------------------------------------------------------- *
         * Search
         * ---------------------------------------------------------- */}
        {searching ? (
          <section className="mx-auto max-w-[1800px] px-4 pb-28 pt-28 sm:px-8 sm:pt-36 lg:px-12">
            <SearchPanel
              query={query}
              onQueryChange={setQuery}
              channels={channels}
              onPlay={openPlayer}
              isFavorite={isFavourite}
              onToggleFavorite={toggleFavourite}
              onClose={() => setQuery("")}
            />
          </section>
        ) : view === "favorites" ? (
          /* ------------------------------------------------------ *
           * Favourites
           * ------------------------------------------------------ */
          <section className="mx-auto max-w-[1800px] px-4 pb-28 pt-28 sm:px-8 sm:pt-36 lg:px-12">
            <div className="mb-8">
              <p className="mb-1.5 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-signal/85">
                <Heart className="size-3.5 fill-current" />
                Colecția ta
              </p>
              <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
                Favorite
              </h1>
              <p className="mt-2 text-sm text-ink-muted">
                Salvate pe acest dispozitiv. Fără cont, fără sincronizare.
              </p>
            </div>

            {favouriteChannels.length === 0 ? (
              <EmptyState
                title="Încă nu ai favorite"
                body="Apasă pe inimă pe orice canal și acesta va apărea aici, gata de urmărit."
                action={
                  <Button variant="primary" onClick={() => setView("home")}>
                    <Compass className="size-4" />
                    Explorează canalele
                  </Button>
                }
              />
            ) : (
              <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                {favouriteChannels.map((channel, index) => (
                  <ChannelCard
                    key={channel.id}
                    channel={channel}
                    onPlay={openPlayer}
                    isFavorite={isFavourite(channel.id)}
                    onToggleFavorite={toggleFavourite}
                    className="w-full"
                    index={index}
                  />
                ))}
              </div>
            )}
          </section>
        ) : (
          /* ------------------------------------------------------ *
           * Home
           * ------------------------------------------------------ */
          <>
            <Hero
              channel={liveChannels[0] ?? channels[0]}
              liveCount={liveChannels.length}
              totalCount={channels.length}
              isFavorite={isFavourite((liveChannels[0] ?? channels[0]).id)}
              onPlay={openPlayer}
              onToggleFavorite={toggleFavourite}
              guide={guide ?? null}
              channels={channels}
              onBrowse={() =>
                document
                  .getElementById("categorii")
                  ?.scrollIntoView({ behavior: "smooth", block: "start" })
              }
            />

            <div id="categorii" className="relative z-10 -mt-6 pb-16 sm:-mt-10">
              {/* Pinned */}
              <ShelfRail
                title="Fixate"
                eyebrow="Scurtăturile tale"
                channels={resolveShelf(shelves.pinned.ids, channels)}
                onPlay={openPlayer}
                isFavorite={isFavourite}
                onToggleFavorite={toggleFavourite}
                onRemove={(channel) => shelves.pinned.unpin(channel.id)}
                onMove={(channel, delta) => shelves.pinned.move(channel.id, delta)}
                emptyHint="Fixează un canal ca să-l ai mereu la îndemână."
              />

              {/* Watch later */}
              <ShelfRail
                title="Mai târziu"
                eyebrow="Pentru când ai timp"
                channels={resolveShelf(shelves.watchLater.ids, channels)}
                onPlay={openPlayer}
                isFavorite={isFavourite}
                onToggleFavorite={toggleFavourite}
                onRemove={(channel) => shelves.watchLater.toggle(channel.id)}
                emptyHint="Adaugă un canal aici ca să-l vezi mai târziu."
              />

              {/* Recently watched */}
              {recentChannels.length > 0 && (
                <ChannelRail
                  eyebrow="Continuă de unde ai rămas"
                  title="Vizionate recent"
                  channels={recentChannels}
                  onPlay={openPlayer}
                  isFavorite={isFavourite}
                  onToggleFavorite={toggleFavourite}
                />
              )}

              {/* Live now */}
              {liveChannels.length > 0 && (
                <ChannelRail
                  eyebrow="Player verificat"
                  title="În direct acum"
                  channels={liveChannels}
                  onPlay={openPlayer}
                  isFavorite={isFavourite}
                  onToggleFavorite={toggleFavourite}
                />
              )}

              {/* A → Z */}
              <div className="px-4 pt-2 sm:px-8 lg:px-12">
                <ChannelIndex channels={channels} onJumpTo={jumpTo} />
              </div>

              {/* One rail per category */}
              {categories.map((category) => {
                const list = byCategory.get(category.id) ?? [];
                if (list.length === 0) return null;
                return (
                  <div
                    key={category.id}
                    ref={(node) => {
                      if (node) railRefs.current.set(category.id, node);
                      else railRefs.current.delete(category.id);
                    }}
                    className="scroll-mt-24"
                  >
                    <ChannelRail
                      eyebrow={category.tagline}
                      title={category.label}
                      channels={list}
                      onPlay={openPlayer}
                      isFavorite={isFavourite}
                      onToggleFavorite={toggleFavourite}
                    />
                  </div>
                );
              })}

              {/* Everything */}
              <section className="px-4 pt-6 sm:px-8 lg:px-12">
                <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
                  <div>
                    <p className="mb-1 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-signal/85">
                      <Radio className="size-3.5" />
                      Cuprins complet
                    </p>
                    <h2 className="font-display text-xl font-semibold tracking-tight sm:text-[26px]">
                      Toate canalele
                    </h2>
                    <p className="mt-1 text-sm text-ink-muted">
                      {channels.length}{" "}
                      {plural(channels.length, "canal", "canale", "de canale")},
                      verificate unul cu unul.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                  {channels.map((channel, index) => (
                    <ChannelCard
                      key={channel.id}
                      channel={channel}
                      onPlay={openPlayer}
                      isFavorite={isFavourite(channel.id)}
                      onToggleFavorite={toggleFavourite}
                      className="w-full"
                      index={index}
                    />
                  ))}
                </div>
              </section>
            </div>
          </>
        )}
      </main>

      <PlayerModal
        channel={active}
        open={playerOpen}
        onOpenChange={setPlayerOpen}
      />
    </div>
  );
}

function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-white/12 bg-white/[0.02] px-6 py-16 text-center">
      <Sparkles className="mx-auto size-6 text-signal/70" />
      <h2 className="mt-4 font-display text-xl font-semibold">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-ink-muted">
        {body}
      </p>
      {action && <div className="mt-6 flex justify-center">{action}</div>}
    </div>
  );
}
