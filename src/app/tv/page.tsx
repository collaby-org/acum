import type { Metadata } from "next";
import { connection } from "next/server";
import { TVDirectory } from "@/components/tv/tv-directory";
import { TVLoginQR } from "@/components/tv/tv-login-qr";
import { AcumMark } from "@/components/brand";
import { CATEGORIES, CHANNELS } from "@/data/channels";
import { toPublicChannels } from "@/lib/catalogue";
import { getSecondaryMeta } from "@/lib/secondary";

export const instant = false;
export const metadata: Metadata = { title: "TV Live — ACUM", robots: { index: true, follow: true } };

export default async function TVPage() {
  await connection();
  const meta = await getSecondaryMeta();
  const channels = toPublicChannels(CHANNELS, meta);
  const live = channels.filter((c) => c.status === "live").length;

  return (
    <main className="min-h-dvh bg-[#0a0a0c] text-ink">
      <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-white/[0.08] bg-[#0a0a0c]/90 backdrop-blur-xl px-6 lg:px-12">
        <a href="/" className="flex items-center gap-3">
          <span className="grid size-9 place-items-center overflow-hidden rounded-[11px] border border-white/10 bg-gradient-to-b from-white/[0.09] to-white/[0.02] shadow">
            <AcumMark id="tv-mark" className="size-[21px]" />
          </span>
          <span className="font-display text-xl font-bold tracking-[0.16em] text-ink">ACUM</span>
        </a>
        <nav className="hidden md:flex items-center gap-3" aria-label="TV navigare">
          <a href="/tv" className="rounded-full px-3 py-1.5 text-sm font-medium text-white">Canale</a>
          <a href="/canale/toate" className="rounded-full px-3 py-1.5 text-sm font-medium text-white/50 hover:text-white transition">Toate canalele</a>
        </nav>
      </header>

      <TVDirectory channels={channels} liveCount={live} />
    </main>
  );
}
