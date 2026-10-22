"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { Compass, Heart, Radio, Sparkles } from "lucide-react";
import type { Category, Channel } from "@/data/types";
import type { EpgGuide } from "@/components/now-next";
import { Header } from "@/components/header";
import { Hero } from "@/components/hero";
import { ChannelRail } from "@/components/channel-rail";
import { TrendingRail } from "@/components/trending-rail";
import { ChannelCard } from "@/components/channel-card";
import { ChannelIndex } from "@/components/channel-index";
import { SearchPanel } from "@/components/search-panel";
import { ShelfRail } from "@/components/shelf-rail";
import { PlayerModal } from "@/components/player";
import { MobileNav, MOBILE_NAV_SPACE } from "@/components/mobile-nav";
import { Button } from "@/components/ui/button";
import { useFavourites, useRecentlyWatched } from "@/hooks/use-favorites";
import { resolveShelf, useShelves } from "@/hooks/use-shelves";
import { useChannelLauncher } from "@/hooks/use-channel-launcher";
import { useLiveAudience } from "@/hooks/use-audience";
import { celebrate, dismiss } from "@/lib/confetti";
import { byPlayability, isPlayable } from "@/lib/channel-meta";
import { CATEGORY_ORDER } from "@/lib/navigation";
import { cn, plural } from "@/lib/utils";

type BrowseProps = {
  channels: Channel[];
  categories: Category[];
  /** Today's programme guide, prepared on the server. */
  guide?: EpgGuide | null;
  /**
   * Our own audience, counted at the proxy: how many browsers are
   * watching each channel here, right now.
   */
  live?: Record<string, number>;
  /**
   * The channel the hero shows — the most watched one that is on air.
   * The server decides it, so the first paint already carries it.
   */
  featured?: Channel | null;
};

type View = "home" | "favorites" | "recent";

/** No audience of our own yet. */
const EMPTY_LIVE: Record<string, number> = {};

export function Browse({
  channels,
  categories,
  guide,
  live: liveFromServer = EMPTY_LIVE,
  featured = null,
}: BrowseProps) {
  const [query, setQuery] = useState("");
  const [view, setView] = useState<View>("home");
  const favourites = useFavourites();
  const recent = useRecentlyWatched();
  const shelves = useShelves();
  const launcher = useChannelLauncher();
  const railRefs = useRef(new Map<string, HTMLElement>());

  /**
   * Our own audience, counted at the proxy.
   *
   * The server measures it when the page is rendered, and the hook keeps it
   * fresh afterwards — the crowd moves while the page is open, and a number
   * that stopped counting would be a number that started lying.
   */
  const { live } = useLiveAudience();
  const audience = useMemo(
    () => ({ ...liveFromServer, ...live }),
    [liveFromServer, live],
  );

  const liveChannels = useMemo(
    () => channels.filter(isPlayable).sort(byPlayability),
    [channels],
  );

  /**
   * The channel the hero shows: the most watched one that is on air right
   * now. A fixed favourite would be a lie by the second the page is open —
   * the crowd moves, and so does the hero. The server has already picked
   * one; the fallback only matters if it could not.
   */
  const trendingChannel = useMemo(() => {
    if (featured) return featured;
    const count = (channel: Channel) =>
      audience[channel.id] ?? channel.views ?? 0;
    const pool = liveChannels.length > 0 ? liveChannels : channels;
    return [...pool].sort((a, b) => count(b) - count(a))[0] ?? channels[0];
  }, [channels, liveChannels, audience, featured]);

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
    launcher.open(channel);
  }, [launcher]);

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
    // The bottom bar of the phone layout is fixed, so the page leaves room
    // for it — otherwise the last rail sits under the bar.
    <div id="top" className={cn("min-h-screen", MOBILE_NAV_SPACE)}>
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
                    guide={guide ?? null}
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
              channel={trendingChannel}
              liveCount={liveChannels.length}
              totalCount={channels.length}
              isFavorite={isFavourite(trendingChannel.id)}
              onPlay={openPlayer}
              onToggleFavorite={toggleFavourite}
              guide={guide ?? null}
              views={audience[trendingChannel.id] ?? trendingChannel.views}
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
                guide={guide ?? null}
                onPlay={openPlayer}
                isFavorite={isFavourite}
                onToggleFavorite={toggleFavourite}
                onRemove={(channel) => shelves.pinned.unpin(channel.id)}
                onMove={(channel, delta) => shelves.pinned.move(channel.id, delta)}
              />

              {/* Watch later */}
              <ShelfRail
                title="Mai târziu"
                eyebrow="Pentru când ai timp"
                channels={resolveShelf(shelves.watchLater.ids, channels)}
                guide={guide ?? null}
                onPlay={openPlayer}
                isFavorite={isFavourite}
                onToggleFavorite={toggleFavourite}
                onRemove={(channel) => shelves.watchLater.toggle(channel.id)}
              />

              {/* Recently watched */}
              {recentChannels.length > 0 && (
                <ChannelRail
                  eyebrow="Continuă de unde ai rămas"
                  title="Vizionate recent"
                  channels={recentChannels}
                  guide={guide ?? null}
                  onPlay={openPlayer}
                  isFavorite={isFavourite}
                  onToggleFavorite={toggleFavourite}
                />
              )}

              {/* Trending — what people are watching right now */}
              <TrendingRail
                channels={channels}
                guide={guide ?? null}
                live={audience}
                onPlay={openPlayer}
                isFavorite={isFavourite}
                onToggleFavorite={toggleFavourite}
              />

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
                      guide={guide ?? null}
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
                      guide={guide ?? null}
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
        channel={launcher.active}
        open={launcher.isOpen}
        onOpenChange={(open) => {
          if (!open) launcher.close();
        }}
      />

      {/* The bar of the phone layout — the way out of an installed app,
          where the browser's own chrome is gone. */}
      <MobileNav
        active={view === "favorites" ? "favorites" : "home"}
        onHome={() => {
          setView("home");
          setQuery("");
          window.scrollTo({ top: 0, behavior: "smooth" });
        }}
        onCategories={() =>
          document
            .getElementById("categorii")
            ?.scrollIntoView({ behavior: "smooth", block: "start" })
        }
        onFavorites={() => setView("favorites")}
        onSearch={() => {
          setView("home");
          const input = document.querySelector<HTMLInputElement>(
            'input[type="search"]',
          );
          input?.focus();
          input?.scrollIntoView({ block: "center", behavior: "smooth" });
        }}
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
