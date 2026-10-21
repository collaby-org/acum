"use client";

import { useCallback, useMemo, useState } from "react";
import { Compass, Heart, LayoutGrid, Search, Sparkles } from "lucide-react";
import type { Category, Channel } from "@/data/channels";
import { Header } from "@/components/header";
import { Hero } from "@/components/hero";
import { ChannelCard } from "@/components/channel-card";
import { ChannelRail } from "@/components/channel-rail";
import { PlayerModal } from "@/components/player-modal";
import { Button } from "@/components/ui/button";
import { useFavorites } from "@/hooks/use-favorites";
import { celebrate, dismiss } from "@/lib/confetti";
import { byPlayability } from "@/lib/channel-meta";
import { normalize, plural } from "@/lib/utils";

type BrowseProps = {
  channels: Channel[];
  categories: Category[];
};

export function Browse({ channels, categories }: BrowseProps) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState<Channel | null>(null);
  const [playerOpen, setPlayerOpen] = useState(false);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const favorites = useFavorites();

  const liveChannels = useMemo(
    () => channels.filter((c) => c.status === "live"),
    [channels],
  );

  const featured = useMemo(() => {
    const preferred = liveChannels.find((c) => c.family === "Antena 1");
    return preferred ?? liveChannels[0] ?? channels[0];
  }, [liveChannels, channels]);

  const byCategory = useMemo(() => {
    const map = new Map<string, Channel[]>();
    for (const category of categories) map.set(category.id, []);
    for (const channel of channels) {
      map.get(channel.category)?.push(channel);
    }
    for (const [key, list] of map) {
      map.set(key, [...list].sort(byPlayability));
    }
    return map;
  }, [channels, categories]);

  const results = useMemo(() => {
    const needle = normalize(query);
    if (!needle) return [];
    return channels
      .filter((c) => {
        const haystack = normalize(
          `${c.name} ${c.family} ${c.label} ${c.category}`,
        );
        return haystack.includes(needle);
      })
      .sort(byPlayability);
  }, [channels, query]);

  const favoriteChannels = useMemo(
    () =>
      channels
        .filter((c) => favorites.ids.includes(c.id))
        .sort(byPlayability),
    [channels, favorites.ids],
  );

  const openPlayer = useCallback((channel: Channel) => {
    setActive(channel);
    setPlayerOpen(true);
  }, []);

  const toggleFavorite = useCallback(
    (channel: Channel, event?: React.MouseEvent<HTMLButtonElement>) => {
      const added = favorites.set.toggle(channel.id);
      const origin = event
        ? {
            x: event.clientX / window.innerWidth,
            y: event.clientY / window.innerHeight,
          }
        : undefined;
      if (added) celebrate(origin);
      else dismiss(origin);
    },
    [favorites.set],
  );

  const isFavorite = useCallback(
    (id: string) => favorites.ids.includes(id),
    [favorites.ids],
  );

  const searching = query.trim().length > 0;
  const showFavorites = favoritesOnly && !searching;

  return (
    <div id="top" className="min-h-screen">
      <Header
        query={query}
        onQueryChange={(value) => {
          setQuery(value);
          if (value.trim()) setFavoritesOnly(false);
        }}
        favoritesCount={favorites.ids.length}
        favoritesActive={favoritesOnly}
        onToggleFavorites={() => {
          setFavoritesOnly((v) => !v);
          setQuery("");
        }}
      />

      <main>
        {/* ---------------------------------------------------------- *
         * Search results
         * ---------------------------------------------------------- */}
        {searching ? (
          <section className="mx-auto max-w-[1800px] px-4 pb-24 pt-28 sm:px-8 sm:pt-36 lg:px-12">
            <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="mb-1.5 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-signal/85">
                  <Search className="size-3.5" />
                  Căutare
                </p>
                <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
                  {results.length}{" "}
                  {plural(results.length, "rezultat", "rezultate", "de rezultate")}
                </h1>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setQuery("")}>
                Șterge căutarea
              </Button>
            </div>

            {results.length === 0 ? (
              <EmptyState
                title="Niciun canal găsit"
                body={`Nu am găsit nimic pentru „${query}”. Încearcă alt nume — de exemplu „Antena”, „HBO” sau „sport”.`}
              />
            ) : (
              <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                {results.map((channel) => (
                  <ChannelCard
                    key={channel.id}
                    channel={channel}
                    onPlay={openPlayer}
                    isFavorite={isFavorite(channel.id)}
                    onToggleFavorite={toggleFavorite}
                    className="w-full"
                  />
                ))}
              </div>
            )}
          </section>
        ) : showFavorites ? (
          /* ------------------------------------------------------ *
           * Favourites
           * ------------------------------------------------------ */
          <section className="mx-auto max-w-[1800px] px-4 pb-24 pt-28 sm:px-8 sm:pt-36 lg:px-12">
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

            {favoriteChannels.length === 0 ? (
              <EmptyState
                title="Încă nu ai favorite"
                body="Apasă pe inimă pe orice canal și acesta va apărea aici, gata de urmărit."
                action={
                  <Button variant="primary" onClick={() => setFavoritesOnly(false)}>
                    <Compass className="size-4" />
                    Explorează canalele
                  </Button>
                }
              />
            ) : (
              <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                {favoriteChannels.map((channel) => (
                  <ChannelCard
                    key={channel.id}
                    channel={channel}
                    onPlay={openPlayer}
                    isFavorite={isFavorite(channel.id)}
                    onToggleFavorite={toggleFavorite}
                    className="w-full"
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
              channel={featured}
              liveCount={liveChannels.length}
              totalCount={channels.length}
              isFavorite={isFavorite(featured.id)}
              onPlay={openPlayer}
              onToggleFavorite={toggleFavorite}
              onBrowse={() =>
                document
                  .getElementById("categorii")
                  ?.scrollIntoView({ behavior: "smooth", block: "start" })
              }
            />

            <div id="categorii" className="relative z-10 -mt-6 pb-10 sm:-mt-10">
              {liveChannels.length > 0 && (
                <ChannelRail
                  eyebrow="Verificat acum"
                  title="În direct acum"
                  channels={liveChannels}
                  onPlay={openPlayer}
                  isFavorite={isFavorite}
                  onToggleFavorite={toggleFavorite}
                />
              )}

              {categories.map((category) => {
                const list = byCategory.get(category.id) ?? [];
                if (list.length === 0) return null;
                return (
                  <ChannelRail
                    key={category.id}
                    eyebrow={category.tagline}
                    title={category.label}
                    channels={list}
                    onPlay={openPlayer}
                    isFavorite={isFavorite}
                    onToggleFavorite={toggleFavorite}
                  />
                );
              })}

              {/* Every channel */}
              <section className="px-4 pt-6 sm:px-8 lg:px-12">
                <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
                  <div>
                    <p className="mb-1 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-signal/85">
                      <LayoutGrid className="size-3.5" />
                      Cuprins complet
                    </p>
                    <h2 className="font-display text-xl font-semibold tracking-tight sm:text-[26px]">
                      Toate canalele
                    </h2>
                    <p className="mt-1 text-sm text-ink-muted">
                      {channels.length} feed-uri, indexate din{" "}
                      <span className="text-ink">cool-etv.net</span>.
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAll((v) => !v)}
                  >
                    {showAll ? "Arată mai puțin" : "Vezi toate"}
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                  {(showAll ? channels : channels.slice(0, 12)).map((channel) => (
                    <ChannelCard
                      key={channel.id}
                      channel={channel}
                      onPlay={openPlayer}
                      isFavorite={isFavorite(channel.id)}
                      onToggleFavorite={toggleFavorite}
                      className="w-full"
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
        isFavorite={active ? isFavorite(active.id) : false}
        onToggleFavorite={toggleFavorite}
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
