"use client";

import { useEffect, useState } from "react";

export default function InstallBanner() {
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const s = window.matchMedia("(display-mode: standalone)").matches;
    const n = (navigator as { standalone?: boolean }).standalone === true ||
              (navigator as { mozStanalone?: boolean }).mozStanalone === true;
    setInstalled(s || n);
  }, []);

  if (installed) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-[70] md:bottom-6 md:left-auto md:right-6 md:max-w-lg rounded-2xl border border-signal/40 bg-surface/95 backdrop-blur-2xl px-5 py-4 shadow-[0_20px_60px_-16px_rgba(242,167,27,0.35)] text-sm leading-relaxed text-ink">
      <div className="font-display text-base font-semibold tracking-tight">Adaugă ACUM pe ecranul principal</div>
      <p className="text-[13px] text-ink-muted mt-1">Pe TV: menu ⋮ → „Adaugă la ecranul principal” (Sony / Samsung / LG / Google TV). După instalare, /tv se deschide direct.</p>
    </div>
  );
}
