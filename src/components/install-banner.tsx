"use client";

import { useEffect, useState } from "react";
import { Monitor, Plus, X } from "lucide-react";

const DISMISS_KEY = "acum-install-dismissed";

/**
 * Big install popup — shown ONLY on TV-like browsers (coarse pointer +
 * large screen, not standalone, not dismissed). Desktop and mobile
 * never see it: their primary pointer is fine or the screen is small.
 */
export default function InstallBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as { standalone?: boolean }).standalone === true;
    const tvLike =
      window.matchMedia("(pointer: coarse)").matches &&
      window.matchMedia("(min-width: 1024px)").matches;
    const dismissed = window.localStorage.getItem(DISMISS_KEY) === "1";
    setShow(!standalone && tvLike && !dismissed);
  }, []);

  if (!show) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-6 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-label="Instalează ACUM pe TV"
    >
      <div className="relative w-full max-w-lg rounded-3xl border border-white/10 bg-[#141118]/95 px-8 py-10 text-center shadow-[0_40px_120px_-30px_rgba(242,167,27,0.45)] backdrop-blur-2xl">
        <button
          type="button"
          aria-label="Închide"
          onClick={() => {
            window.localStorage.setItem(DISMISS_KEY, "1");
            setShow(false);
          }}
          className="absolute right-4 top-4 grid size-9 place-items-center rounded-full text-white/50 transition hover:bg-white/10 hover:text-white"
        >
          <X className="size-5" aria-hidden />
        </button>

        <div className="mx-auto mb-6 grid size-16 place-items-center rounded-full border border-signal/30 bg-gradient-to-b from-signal/20 to-signal/5 shadow-[0_0_40px_-10px_rgba(242,167,27,0.6)]">
          <Monitor className="size-8 text-signal" aria-hidden />
        </div>

        <h2 className="font-display text-2xl font-bold tracking-tight text-white">
          Adaugă ACUM pe ecranul principal
        </h2>
        <p className="mt-3 text-[15px] leading-relaxed text-white/70">
          Pe TV: deschide meniul browserului (⋮) → „Instalează aplicația”.
          Dacă opțiunea lipsește, /tv funcționează direct ca aplicație.
        </p>

        <a
          href="/tv"
          className="mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-signal px-7 text-[15px] font-bold text-[#141005] shadow-[0_8px_30px_-10px_rgba(242,167,27,0.7)] transition hover:bg-signal-bright"
        >
          <Plus className="size-5" aria-hidden />
          Deschide /tv acum
        </a>

        <p className="mt-4 text-[11px] text-white/40">
          Cont și confirmare gospodărie: scanează codul QR de pe /tv cu telefonul.
        </p>
      </div>
    </div>
  );
}
