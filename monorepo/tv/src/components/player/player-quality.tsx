/**
 * The quality badge, and the menu that opens above it.
 *
 * The badge reads the picture, not the playlist: the stream's own decoded
 * size is what the viewer is actually watching, and it moves under them
 * when hls.js decides the connection can carry another rung. The label is
 * therefore the catalogue's word for that height — the same word the rest
 * of the app uses.
 *
 * The menu names every rung the manifest carries and lets the viewer pin
 * one, or hand the choice back to the connection. It is the hls.js
 * instance that holds both the ladder and the answer, so the player reads
 * them off the instance and passes them in; this file never touches hls.js
 * itself.
 *
 * The menu opens upward, out of the player. Drawn inside the badge it is
 * a child of whatever the badge sits in: the picture frame clips it, and
 * the fullscreen bar — a layer of its own — holds it under the wall. So
 * it is portaled to the body and pinned to the badge's own position,
 * re-measured whenever the badge moves.
 */
"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Signal } from "lucide-react";
import type { Quality } from "@/data/types";
import { QUALITY_META } from "@/lib/channel-meta";
import { cn } from "@/lib/utils";

/** One rung of the manifest's ladder, as the badge needs to see it. */
export type QualityVariant = {
  /** The rung's place in `hls.levels`. */
  index: number;
  width: number;
  height: number;
  /** Peak bandwidth of the rung, in bits per second. */
  bitrate: number;
};

export type PlayerQualityBadgeProps = {
  /** The ladder the manifest carries, already sorted high to low. */
  variants: readonly QualityVariant[];
  /**
   * The rung hls.js is pinned to, or `-1` while it decides by bandwidth.
   */
  currentLevel: number;
  /** The picture's own decoded size, when the browser knows it. */
  stream?: { width: number; height: number } | null;
  /** Pin a rung, or pass `-1` to hand the choice back to the connection. */
  onLevelChange: (index: number) => void;
  className?: string;
};

/* ------------------------------------------------------------------ *
 * Naming
 * ------------------------------------------------------------------ */

/** The height at which a picture earns each of the catalogue's words. */
const UHD_HEIGHT = 2160;
const FHD_HEIGHT = 1080;
const HD_HEIGHT = 720;
const SD_HEIGHT = 480;

/** The quality a decoded height stands for. */
function qualityOfHeight(height: number): Quality {
  if (!Number.isFinite(height) || height <= 0) return "unknown";
  if (height >= UHD_HEIGHT) return "uhd";
  if (height >= FHD_HEIGHT) return "fhd";
  if (height >= HD_HEIGHT) return "hd";
  if (height >= SD_HEIGHT) return "sd";
  return "low";
}

/** A bandwidth as a Romanian player writes it: "4,2 Mbps", "900 kbps". */
function formatBitrate(bitrate: number): string | null {
  if (!Number.isFinite(bitrate) || bitrate <= 0) return null;
  if (bitrate >= 1_000_000) {
    return `${(bitrate / 1_000_000).toFixed(1).replace(".", ",")} Mbps`;
  }
  return `${Math.round(bitrate / 1000)} kbps`;
}

/** One row of the ladder: the check marks what is in use, never colour. */
function rungClassName(active: boolean): string {
  return cn(
    "flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left text-[12px] text-ink-muted",
    "transition-colors duration-200 hover:bg-white/8 hover:text-ink",
    "focus-visible:bg-white/8 focus-visible:text-ink focus-visible:outline-none",
    active && "text-ink",
  );
}

/* ------------------------------------------------------------------ *
 * The menu, out in the open
 * ------------------------------------------------------------------ */

/** The menu's own width — `w-52`, spelled for the arithmetic below. */
const MENU_WIDTH = 208;
/** The air between the badge and the menu. */
const MENU_GAP = 8;
/** The shortest menu the viewport may leave room for. */
const MENU_MIN_HEIGHT = 180;

/** Where the menu sits, in viewport pixels. */
type MenuSpot = {
  top: number;
  left: number;
  maxHeight: number;
};

/* ------------------------------------------------------------------ *
 * The badge
 * ------------------------------------------------------------------ */

export function PlayerQualityBadge({
  variants,
  currentLevel,
  stream = null,
  onLevelChange,
  className,
}: PlayerQualityBadgeProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [spot, setSpot] = useState<MenuSpot | null>(null);

  const close = useCallback(() => setOpen(false), []);

  /**
   * Whether a node belongs to the badge — the trigger or the menu.
   *
   * The menu is portaled out of the badge's own DOM, so a press or a
   * focus that lands in it still counts as inside.
   */
  const owns = useCallback((node: Node | null | undefined): boolean => {
    if (!node) return false;
    return Boolean(
      rootRef.current?.contains(node) || menuRef.current?.contains(node),
    );
  }, []);

  // Escape closes the menu and gives the trigger its focus back.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      triggerRef.current?.focus();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  // A press anywhere outside the menu closes it. Captured, so it is seen
  // on the way down, before anything else acts on it.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (owns(event.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [open, owns]);

  // Focus lands on the rung already in use, so the arrows have somewhere
  // to start.
  useEffect(() => {
    if (!open) return;
    const menu = menuRef.current;
    if (!menu) return;
    const chosen =
      menu.querySelector<HTMLButtonElement>(
        '[data-quality-item][aria-checked="true"]',
      ) ??
      menu.querySelector<HTMLButtonElement>("[data-quality-item]");
    chosen?.focus();
  }, [open]);

  /**
   * Where the menu goes, and where it goes again.
   *
   * Above the badge, never below it: the badge sits at the bottom of the
   * picture, and a menu that opened downward would fall off the frame.
   * The measurement is taken in the viewport, because that is where the
   * portaled menu lives — and it is taken again on every move of the page,
   * since the badge moves with the scroll, with the window, and with the
   * picture going full screen.
   */
  useLayoutEffect(() => {
    // Closed, the menu is not on the page; the spot it last held is
    // re-measured the moment it opens again, before anything paints.
    if (!open) return;

    const place = () => {
      const trigger = triggerRef.current;
      const menu = menuRef.current;
      if (!trigger || !menu) return;

      const rect = trigger.getBoundingClientRect();
      const room = Math.max(MENU_MIN_HEIGHT, rect.top - MENU_GAP * 2);
      // `scrollHeight` is the content's own height: the cap never feeds
      // back into the measurement, so opening cannot chase itself.
      const height = Math.min(menu.scrollHeight, room);
      const left = Math.max(
        MENU_GAP,
        Math.min(rect.right - MENU_WIDTH, window.innerWidth - MENU_WIDTH - MENU_GAP),
      );

      setSpot({
        top: Math.max(MENU_GAP, rect.top - MENU_GAP - height),
        left,
        maxHeight: room,
      });
    };

    place();

    window.addEventListener("resize", place);
    // Captured: a scroll anywhere in the page moves the badge, not only
    // one on the player itself.
    window.addEventListener("scroll", place, true);
    document.addEventListener("fullscreenchange", place);
    document.addEventListener("webkitfullscreenchange", place);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
      document.removeEventListener("fullscreenchange", place);
      document.removeEventListener("webkitfullscreenchange", place);
    };
  }, [open]);

  // No ladder means nothing to choose: the manifest has not been parsed
  // yet — or this is a browser that plays HLS on its own and never hands
  // the rungs over. The badge stays away rather than opening an empty menu.
  if (variants.length === 0) return null;

  // What the viewer is watching, read off the decoder first: a rung switch
  // rewrites the picture's own size, and the label follows it. The pinned
  // rung is the answer only while no picture has arrived yet.
  const decoded = stream && stream.height > 0 ? stream.height : 0;
  const pinned =
    currentLevel >= 0
      ? (variants.find((variant) => variant.index === currentLevel)?.height ?? 0)
      : 0;
  const label = QUALITY_META[qualityOfHeight(decoded || pinned)].label || "Automată";

  const moveFocus = (step: number) => {
    const menu = menuRef.current;
    if (!menu) return;
    const items = Array.from(
      menu.querySelectorAll<HTMLButtonElement>("[data-quality-item]"),
    );
    const at = items.indexOf(document.activeElement as HTMLButtonElement);
    items[(at + step + items.length) % items.length]?.focus();
  };

  const menuStyle: CSSProperties = {
    top: spot?.top ?? 0,
    left: spot?.left ?? 0,
    maxHeight: spot?.maxHeight,
    // The first frame is not placed yet; it is measured in the layout
    // effect below and never painted off its mark.
    visibility: spot ? "visible" : "hidden",
  };

  return (
    <div
      ref={rootRef}
      // Tab away closes the menu, the way a menu does.
      onBlur={(event) => {
        if (!owns(event.relatedTarget as Node | null)) close();
      }}
      className={cn("relative shrink-0", className)}
    >
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Calitate: ${label}`}
        title="Calitate"
        className={cn(
          "inline-flex h-6 items-center gap-1.5 rounded-full border border-white/12",
          "bg-black/55 py-0 pl-2 pr-1.5 text-ink/90 backdrop-blur-md",
          "transition-colors duration-300 hover:border-white/20 hover:bg-black/75",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal",
        )}
      >
        <Signal className="size-3.5 text-signal" aria-hidden />
        <span className="font-display text-[10px] font-semibold uppercase tracking-[0.14em]">
          {label}
        </span>
        <ChevronDown
          aria-hidden
          className={cn(
            "size-3 text-ink-faint transition-transform duration-300 ease-spring",
            open && "rotate-180",
          )}
        />
      </button>

      {open
        ? createPortal(
            <div
              ref={menuRef}
              role="menu"
              aria-label="Calitate"
              onKeyDown={(event) => {
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  moveFocus(1);
                } else if (event.key === "ArrowUp") {
                  event.preventDefault();
                  moveFocus(-1);
                }
              }}
              style={menuStyle}
              className={cn(
                // Fixed to the viewport and out of the player's own layers:
                // `z-[70]` puts it above the frame's overlays, the wall and
                // the fullscreen bar alike, and nothing above it clips its
                // rounded corners.
                "fixed z-[70] w-52 origin-bottom-right overflow-y-auto",
                "rounded-2xl border border-white/10 bg-canvas-raised/95 p-1.5 shadow-[var(--shadow-e4)]",
                "backdrop-blur-xl fx-hide-scrollbar animate-scale-in",
              )}
            >
              <p className="px-2.5 pb-1.5 pt-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-signal/85">
                Calitate
              </p>
              <div aria-hidden className="fx-divider mx-2 mb-1.5" />

              <button
                type="button"
                role="menuitemradio"
                aria-checked={currentLevel === -1}
                data-quality-item
                onClick={() => {
                  onLevelChange(-1);
                  close();
                }}
                className={rungClassName(currentLevel === -1)}
              >
                <span aria-hidden className="grid size-4 shrink-0 place-items-center">
                  {currentLevel === -1 ? (
                    <Check className="size-3.5 text-signal" />
                  ) : null}
                </span>
                <span className="truncate">Automată</span>
                <span className="ml-auto font-mono text-[10px] tabular-nums text-ink-faint">
                  după conexiune
                </span>
              </button>

              {variants.map((variant) => {
                const active = currentLevel === variant.index;
                const rate = formatBitrate(variant.bitrate);
                return (
                  <button
                    key={variant.index}
                    type="button"
                    role="menuitemradio"
                    aria-checked={active}
                    data-quality-item
                    onClick={() => {
                      onLevelChange(variant.index);
                      close();
                    }}
                    className={rungClassName(active)}
                  >
                    <span aria-hidden className="grid size-4 shrink-0 place-items-center">
                      {active ? <Check className="size-3.5 text-signal" /> : null}
                    </span>
                    <span className="font-display tabular-nums">
                      {variant.height > 0
                        ? `${variant.height}p`
                        : `Nivel ${variant.index + 1}`}
                    </span>
                    {rate ? (
                      <span className="ml-auto font-mono text-[10px] tabular-nums text-ink-faint">
                        {rate}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
