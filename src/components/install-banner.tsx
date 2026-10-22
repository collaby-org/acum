"use client";

import { useEffect, useState } from "react";

export default function InstallBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches;
    const nativeApp = (window.navigator as { standalone?: boolean }).standalone === true ||
                      (window.navigator as { mozStanalone?: boolean }).mozStanalone === true;
    if (!standalone && !nativeApp && document.referrer.indexOf(window.location.host) === -1) {
      setShow(true);
    }
  }, []);

  if (!show) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-[70] md:left-auto md:right-6 md:bottom-6 md:max-w-md rounded-2xl border border-signal/40 bg-surface/95 backdrop-blur-2xl px-5 py-4 shadow-[0_20px_60px_-16px_rgba(242,167,27,0.35)] text-sm leading-relaxed text-ink flex flex-col md:flex-row md:items-center gap-3">
      <span className="font-display text-base font-semibold tracking-tight">Adaugă ACUM pe ecranul principal</span>
      <p className="text-[13px] text-ink-muted">Apasă ⋮ → „Instalează aplicația" (Sony / Samsung / LG / Google TV) pentru acces instant.</p>
    </div>
  );
}
