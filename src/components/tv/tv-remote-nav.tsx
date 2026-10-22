"use client";
import { useEffect, useRef } from "react";

export function TVRemoteNav({ containerRef }: { containerRef: React.RefObject<HTMLDivElement | null> }) {
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const cards = Array.from(el.querySelectorAll<HTMLAnchorElement>("[data-tvc]"));
    let idx = cards.findIndex((c) => c.getAttribute("aria-current") === "true");
    if (idx < 0) idx = 0;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") { e.preventDefault(); idx = Math.min(idx + 1, cards.length - 1); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); idx = Math.max(idx - 1, 0); }
      else if (e.key === "ArrowDown") { e.preventDefault(); idx = Math.min(idx + 2, cards.length - 1); }
      else if (e.key === "ArrowUp") { e.preventDefault(); idx = Math.max(idx - 2, 0); }
      else if (e.key === "Enter") { e.preventDefault(); cards[idx]?.click(); return; }
      else if (e.key === "Backspace" || e.key === "Back" || (e.key === "Escape" && !e.shiftKey)) {
        e.preventDefault(); window.history.back(); return;
      } else return;
      cards.forEach((c, i) => c.setAttribute("aria-current", i === idx ? "true" : "false"));
      cards[idx]?.focus();
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [containerRef]);
  return null;
}
