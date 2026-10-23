"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, MonitorPlay, Play, QrCode, Smartphone, MousePointer2, ChevronRight, X, Volume2, Pause, Play as PlayIcon, SkipBack, SkipForward } from "lucide-react";
import { VideoPlayer } from "@/components/player/video-player";
import { TVPlayerFullscreen, type TVChannel } from "./tv-player-fullscreen";
import { useAccount } from "@/hooks/use-account";
import { STATUS_META } from "@/lib/channel-meta";

export type TVDirectoryChannel = {
  id: string;
  name: string;
  family: string;
  familyKey: string;
  category: string;
  logo: string | null;
  logoHd: string | null;
  status?: string;
};

export type TVDirectoryProps = {
  channels: TVDirectoryChannel[];
  liveCount?: number;
};

const NO_CURSOR = `.tv-root, .tv-root * { cursor: none !important; }`;

/* ===== TV Landing Page (signed out) ===== */
export function TVLandingPage() {
  const [authMode, setAuthMode] = useState<"qr" | "phone" | null>(null);

  if (authMode) return <TVAuthFlow mode={authMode} onBack={() => setAuthMode(null)} />;

  return (
    <div className="tv-root min-h-dvh bg-[#0a0a0c] text-white flex flex-col">
      <style>{NO_CURSOR}</style>
      <main className="flex-1 flex flex-col items-center justify-center px-6">
        {/* Hero */}
        <div className="max-w-5xl w-full text-center mb-16">
          <div className="mx-auto mb-8 grid size-24 place-items-center rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.08] to-white/[0.02] shadow-[0_40px_120px_-30px_rgba(0,0,0,0.8)]">
            <MonitorPlay className="size-12 text-white/80" aria-hidden />
          </div>
          <h1 className="font-display text-5xl font-bold tracking-tight mb-4">Bine ai venit pe ACUM TV</h1>
          <p className="text-lg text-white/50 max-w-2xl mx-auto mb-12">
            Canale live din România, fără reclame, cu ghid TV și audiență live.
          </p>
        </div>

        {/* Auth Options */}
        <div className="max-w-5xl w-full grid md:grid-cols-2 gap-8">
          {/* Sign In */}
          <button
            onClick={() => setAuthMode("qr")}
            className="group relative p-8 rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.08] to-white/[0.02] text-left transition hover:border-signal/50 hover:bg-white/[0.05] focus:outline-none focus-visible:ring-2 focus-visible:ring-signal"
          >
            <div className="flex items-center gap-4 mb-6">
              <div className="grid size-14 place-items-center rounded-2xl border border-signal/30 bg-signal/10">
                <QrCode className="size-7 text-signal" aria-hidden />
              </div>
              <div>
                <h2 className="font-display text-2xl font-bold">Autentificare</h2>
                <p className="text-white/50 text-sm">Ai deja cont? Conectează-te rapid.</p>
              </div>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-3 text-white/70">
                <Smartphone className="size-5 text-signal" aria-hidden />
                <span>Continuă pe telefon</span>
                <ChevronRight className="size-4 ml-auto text-white/30 group-hover:text-signal transition" />
              </div>
              <div className="flex items-center gap-3 text-white/70">
                <QrCode className="size-5 text-signal" aria-hidden />
                <span>Scanează codul QR</span>
                <ChevronRight className="size-4 ml-auto text-white/30 group-hover:text-signal transition" />
              </div>
            </div>
          </button>

          {/* Register */}
          <button
            onClick={() => setAuthMode("phone")}
            className="group relative p-8 rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.08] to-white/[0.02] text-left transition hover:border-signal/50 hover:bg-white/[0.05] focus:outline-none focus-visible:ring-2 focus-visible:ring-signal"
          >
            <div className="flex items-center gap-4 mb-6">
              <div className="grid size-14 place-items-center rounded-2xl border border-white/10 bg-white/[0.05]">
                <MousePointer2 className="size-7 text-white/50" aria-hidden />
              </div>
              <div>
                <h2 className="font-display text-2xl font-bold">Creare cont</h2>
                <p className="text-white/50 text-sm">Nou aici? Creează contul tău gratuit.</p>
              </div>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-3 text-white/70">
                <Smartphone className="size-5 text-signal" aria-hidden />
                <span>Continuă pe telefon</span>
                <ChevronRight className="size-4 ml-auto text-white/30 group-hover:text-signal transition" />
              </div>
              <div className="flex items-center gap-3 text-white/70">
                <MousePointer2 className="size-5 text-white/50" aria-hidden />
                <span>Continuă în browser</span>
                <ChevronRight className="size-4 ml-auto text-white/30 group-hover:text-signal transition" />
              </div>
            </div>
          </button>
        </div>

        <p className="mt-12 text-xs text-white/30 text-center max-w-2xl mx-auto">
          Fără abonament pentru vizionare. 2 ore gratuite zilnic. Abonamentele deblochează acces nelimitat și profiluri multiple.
        </p>
      </main>
    </div>
  );
}

/* ===== TV Auth Flow (QR or Phone) ===== */
interface TVAuthFlowProps {
  mode: "qr" | "phone";
  onBack: () => void;
}

function TVAuthFlow({ mode, onBack }: TVAuthFlowProps) {
  const [poll, setPoll] = useState(false);
  const url = typeof window !== "undefined"
    ? `${window.location.origin}/auth/qrcode${mode === "phone" ? "?mode=phone" : ""}`
    : "/auth/qrcode";

  useEffect(() => {
    if (mode === "qr") {
      const timer = window.setInterval(async () => {
        try {
          const response = await fetch("/api/auth/confirm-tv", {
            method: "GET",
            credentials: "include",
            cache: "no-store",
          });
          if (response.ok) {
            setPoll(true);
            window.clearInterval(timer);
            window.location.reload();
          }
        } catch { }
      }, 1500);
      return () => window.clearInterval(timer);
    }
  }, [mode]);

  return (
    <div className="tv-root min-h-dvh bg-[#0a0a0c] text-white flex flex-col">
      <style>{NO_CURSOR}</style>
      <main className="flex-1 flex flex-col items-center justify-center px-6 gap-8">
        <button
          onClick={onBack}
          className="self-start inline-flex items-center gap-2 text-white/60 hover:text-white transition"
        >
          <ArrowLeft className="size-5" aria-hidden />
          Înapoi
        </button>

        {mode === "qr" ? (
          <div className="text-center">
            <h1 className="font-display text-3xl font-bold tracking-tight mb-2">Autentificare</h1>
            <p className="text-white/50 mb-8 max-w-md mx-auto">Scanează cu telefonul pentru a autoriza acest ecran.</p>
            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-[0_20px_60px_-16px_rgba(0,0,0,1)] backdrop-blur-xl inline-block">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=340x340&data=${encodeURIComponent(url)}`}
                alt="Cod QR — conectare ACUM pe TV"
                className="rounded-2xl w-80 h-80"
              />
            </div>
            <p className="mt-6 text-xs text-white/30 tracking-wide uppercase font-medium">Scanează cu aplicația camerei</p>
            {poll && <p className="mt-4 text-sm text-live font-medium">Autentificat. Se încarcă…</p>}
          </div>
        ) : (
          <div className="text-center max-w-md">
            <h1 className="font-display text-3xl font-bold tracking-tight mb-2">Continuă pe telefon</h1>
            <p className="text-white/50 mb-8">Deschide linkul pe telefon pentru a te autentifica sau crea cont.</p>
            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-[0_20px_60px_-16px_rgba(0,0,0,1)] backdrop-blur-xl inline-block">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=340x340&data=${encodeURIComponent(url)}`}
                alt="Cod QR — deschide pe telefon"
                className="rounded-2xl w-80 h-80"
              />
            </div>
            <p className="mt-4 text-xs text-white/30 tracking-wide uppercase font-medium">Scanează pentru a deschide pe telefon</p>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 inline-flex h-12 items-center gap-3 rounded-full bg-signal px-8 text-base font-bold text-[#141005] shadow-[0_8px_30px_-10px_rgba(242,167,27,0.7)] transition hover:bg-signal-bright"
            >
              <Smartphone className="size-5" aria-hidden />
              Deschide pe telefon
            </a>
          </div>
        )}
      </main>
    </div>
  );
}

/* ===== Netflix-style Catalog (signed in) ===== */
export function TVDirectory({ channels, liveCount = 0 }: TVDirectoryProps) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [full, setFull] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const openChannel = channels.find((c) => c.id === openId) ?? null;
  const detailChannel = channels.find((c) => c.id === detailId) ?? null;
  const { signedIn } = useAccount();

  const featured = channels.find((c) => c.status === "live") ?? channels[0] ?? null;
  const liveChannels = channels.filter((c) => c.status === "live");
  const otherChannels = channels.filter((c) => c.status !== "live");

  useEffect(() => {
    const onBack = (e: KeyboardEvent) => {
      if (e.key === "Back" || (e.key === "Escape" && !e.shiftKey)) {
        if (full) setFull(false);
        else if (detailId) setDetailId(null);
        else if (openId) setOpenId(null);
      }
    };
    window.addEventListener("keydown", onBack);
    return () => window.removeEventListener("keydown", onBack);
  }, [full, detailId, openId]);

  /* Full screen player */
  if (openChannel && full) {
    return (
      <div className="tv-root min-h-dvh bg-black">
        <style>{NO_CURSOR}</style>
        <TVPlayerFullscreen
          channel={openChannel as unknown as TVChannel}
          onBack={() => setFull(false)}
        />
      </div>
    );
  }

  /* Channel detail page */
  if (detailChannel) {
    return (
      <div className="tv-root min-h-dvh bg-[#0a0a0c] text-white">
        <style>{NO_CURSOR}</style>
        <main className="mx-auto max-w-5xl px-6 py-8 lg:px-12">
          <button
            type="button"
            onClick={() => setDetailId(null)}
            className="inline-flex h-11 items-center gap-2 rounded-full border border-white/12 bg-white/[0.06] px-5 text-sm font-medium text-white transition focus:outline-none focus-visible:ring-2 focus-visible:ring-signal hover:bg-white/[0.12]"
          >
            <ArrowLeft className="size-4" aria-hidden />
            Înapoi la catalog
          </button>

          <div className="mt-6 grid lg:grid-cols-3 gap-8">
            {/* Preview player */}
            <div className="lg:col-span-2">
              <div className="overflow-hidden rounded-2xl border border-white/10 bg-black shadow-[0_30px_80px_-30px_rgba(0,0,0,0.9)] aspect-video">
                <VideoPlayer
                  channelName={detailChannel.name}
                  channelId={detailChannel.id}
                  autoPlay
                  className="w-full h-full"
                />
              </div>
            </div>

            {/* Channel info */}
            <div className="flex flex-col justify-start">
              <div className="grid size-20 place-items-center overflow-hidden rounded-2xl border border-white/10 bg-black shadow-lg">
                {detailChannel.logoHd ? (
                  <img src={detailChannel.logoHd} alt="" className="max-h-14 max-w-24 object-contain" />
                ) : (
                  <MonitorPlay className="size-8 text-white/50" aria-hidden />
                )}
              </div>
              <div className="mt-6">
                <h1 className="font-display text-3xl font-bold tracking-tight">{detailChannel.name}</h1>
                <p className="mt-2 text-sm text-white/50 flex items-center gap-2">
                  {detailChannel.status === "live" && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2 py-0.5 text-[11px] font-semibold text-red-400">
                      <span className="size-1.5 rounded-full bg-red-500 animate-pulse" aria-hidden />
                      LIVE
                    </span>
                  )}
                  <span>{detailChannel.category}</span>
                </p>
                <p className="mt-4 text-base text-white/70 leading-relaxed">
                  Vizionează {detailChannel.name} live, fără reclame și fără urmărire. Calitate HD, fluxuri verificate.
                </p>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="mt-8 flex flex-wrap items-center justify-start gap-4">
            <button
              type="button"
              onClick={() => { setOpenId(detailChannel.id); setFull(true); }}
              className="inline-flex h-14 items-center gap-3 rounded-full bg-signal px-8 text-lg font-bold text-[#141005] shadow-[0_10px_40px_-10px_rgba(242,167,27,0.7)] transition focus:outline-none focus-visible:ring-2 focus-visible:ring-signal focus-visible:ring-offset-4 focus-visible:ring-offset-[#0a0a0c] hover:bg-signal-bright"
            >
              <Play className="size-6" aria-hidden />
              Redă acum
            </button>
            <button
              type="button"
              className="inline-flex h-14 items-center gap-3 rounded-full border border-white/12 bg-white/[0.06] px-8 text-lg font-medium text-white transition hover:bg-white/[0.12]"
            >
              <ArrowLeft className="size-6" aria-hidden />
              Înapoi
            </button>
          </div>
        </main>
      </div>
    );
  }

  /* Netflix-style Catalog Rows */
  const FOCUSED_CARD = "ring-2 ring-signal ring-offset-2 ring-offset-[#0a0a0c] bg-white/[0.08] scale-[1.03] shadow-[0_0_0_4px_rgba(242,167,27,0.25)]";
  const [focusedIndex, setFocusedIndex] = useState<number | null>(0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (openId || full || detailId) return;
      const last = channels.length - 1;
      if (e.key === "ArrowDown" || e.key === "ArrowRight") {
        e.preventDefault();
        setFocusedIndex((i) => (i == null || i >= last ? 0 : i + 1));
      } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
        e.preventDefault();
        setFocusedIndex((i) => (i == null || i <= 0 ? last : i - 1));
      } else if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        if (focusedIndex != null) setDetailId(channels[focusedIndex]!.id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [channels, openId, full, detailId, focusedIndex]);

  return (
    <div className="tv-root min-h-dvh bg-[#0a0a0c] text-white">
      <style>{NO_CURSOR}</style>
      <main className="mx-auto max-w-7xl px-6 py-8 lg:px-12">
        {/* Hero / Featured */}
        {featured && (
          <section className="mb-12">
            <button
              type="button"
              onClick={() => setDetailId(featured.id)}
              className="group relative block w-full overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.07] to-white/[0.02] p-8 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-signal sm:p-12"
            >
              <div className="flex flex-wrap items-center gap-6">
                <div className="grid size-24 shrink-0 place-items-center overflow-hidden rounded-2xl border border-white/10 bg-black shadow-xl">
                  {featured.logoHd ? (
                    <img src={featured.logoHd} alt="" className="max-h-16 max-w-32 object-contain" />
                  ) : (
                    <MonitorPlay className="size-10 text-white/50" aria-hidden />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-signal">Acum la TV</p>
                  <h2 className="mt-1 font-display text-4xl font-bold tracking-tight sm:text-6xl">{featured.name}</h2>
                  <p className="mt-3 text-base text-white/50">{liveCount} canale live · Apasă pentru detalii</p>
                </div>
                <span className="inline-flex h-14 items-center gap-3 rounded-full bg-white px-8 text-base font-bold text-black transition group-hover:bg-signal">
                  <Play className="size-6" aria-hidden />
                  Detalii
                </span>
              </div>
            </button>
          </section>
        )}

        {/* Live Now Row */}
        {liveChannels.length > 0 && (
          <section className="mb-12">
            <header className="mb-6 flex items-end justify-between">
              <h2 className="font-display text-2xl font-bold tracking-tight">În direct acum</h2>
              <p className="text-sm text-white/40">{liveChannels.length} canale</p>
            </header>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {liveChannels.map((c, i) => {
                const focused = focusedIndex === i;
                return (
                  <button
                    key={c.id}
                    type="button"
                    tabIndex={-1}
                    onClick={() => { setFocusedIndex(i); setDetailId(c.id); }}
                    className={`group flex flex-col items-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5 text-center transition focus:outline-none focus-visible:ring-2 focus-visible:ring-signal focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0c] hover:bg-white/[0.07] ${focused ? FOCUSED_CARD : ""}`}
                  >
                    <div className="grid size-14 place-items-center overflow-hidden rounded-xl border border-white/10 bg-black shadow-md relative">
                      {c.logoHd ? (
                        <img src={c.logoHd} alt={c.name} className="max-h-10 max-w-[72px] object-contain" loading="lazy" />
                      ) : (
                        <span className="text-xs font-bold text-white/70">{c.name.slice(0, 2).toUpperCase()}</span>
                      )}
                      <span className="absolute top-2 right-2 inline-flex items-center gap-1 rounded-full bg-red-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-red-400">
                        <span className="size-1 rounded-full bg-red-500 animate-pulse" aria-hidden />
                        LIVE
                      </span>
                    </div>
                    <div>
                      <h3 className="font-display text-base font-semibold leading-snug">{c.name}</h3>
                      <span className="text-xs text-white/40">{c.category}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* All Channels Row */}
        <section>
          <header className="mb-6 flex items-end justify-between">
            <h2 className="font-display text-2xl font-bold tracking-tight">Toate canalele</h2>
            <p className="text-sm text-white/40">{channels.length} canale</p>
          </header>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {channels.map((c, i) => {
              const focused = focusedIndex === i;
              return (
                <button
                  key={c.id}
                  type="button"
                  tabIndex={-1}
                  onClick={() => { setFocusedIndex(i); setDetailId(c.id); }}
                  className={`group flex flex-col items-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5 text-center transition focus:outline-none focus-visible:ring-2 focus-visible:ring-signal focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0c] hover:bg-white/[0.07] ${focused ? FOCUSED_CARD : ""}`}
                >
                  <div className="grid size-14 place-items-center overflow-hidden rounded-xl border border-white/10 bg-black shadow-md">
                    {c.logoHd ? (
                      <img src={c.logoHd} alt={c.name} className="max-h-10 max-w-[72px] object-contain" loading="lazy" />
                    ) : (
                      <span className="text-xs font-bold text-white/70">{c.name.slice(0, 2).toUpperCase()}</span>
                    )}
                  </div>
                  <div>
                    <h3 className="font-display text-base font-semibold leading-snug">{c.name}</h3>
                    <span className="text-xs text-white/40">{c.status === "live" ? "Live" : c.status}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}