"use client";

import { useEffect, useState } from "react";
import { Monitor, Plus, ExternalLink } from "lucide-react";

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
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 backdrop-blur-md" aria-modal="true" role="dialog" aria-label="Instalează ACUM pe TV">
      <div className="mx-6 w-full max-w-lg rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.08] to-white/[0.02] backdrop-blur-2xl shadow-[0_40px_120px_-30px_rgba(242,167,27,0.45)] px-8 py-10 text-center">
        <div className="mx-auto mb-6 grid size-16 place-items-center rounded-full bg-gradient-to-b from-signal/20 to-signal/5 border border-signal/30 shadow-[0_0_40px_-10px_rgba(242,167,27,0.6)]">
          <Monitor className="size-8 text-signal" aria-hidden />
        </div>
        <h2 className="font-display text-2xl font-bold tracking-tight text-ink">Adaugă ACUM pe ecranul principal</h2>
        <p className="mt-3 text-[15px] leading-relaxed text-ink-muted">
          Dacă browserul tău arată meniu (⋮) cu „Favorit”, „Setări” — caută <strong>„Instalează aplicația”</strong> acolo. Dacă nu există, folosește butonul de mai jos pentru <strong>/tv</strong> direct.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <a href="/tv" className="inline-flex h-12 items-center gap-2 rounded-full bg-signal px-7 text-[15px] font-semibold text-[#141005] shadow-[0_8px_30px_-10px_rgba(242,167,27,0.7)] transition hover:bg-signal-bright">
            <ExternalLink className="size-4" aria-hidden />
            Deschide /tv direct
          </a>
        </div>
        <p className="mt-4 text-[11px] text-ink-faint/70">După instalare, /tv se deschide direct din iconiță. Fără cont necesar pentru vizionare.</p>
      </div>
    </div>
  );
}
