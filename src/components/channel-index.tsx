"use client";

import { useRef } from "react";
import type { KeyboardEvent } from "react";
import { alphabetBuckets, type ChannelLike } from "@/lib/navigation";
import { cn, plural } from "@/lib/utils";

type ChannelIndexProps<T extends ChannelLike> = {
  channels: T[];
  /**
   * The selected bucket key — a letter, "0-9" or "#" — or null for the
   * whole catalogue. Controlled by the host, which owns the filtered grid.
   */
  value: string | null;
  /** Called when a letter is chosen, or when the filter is cleared. */
  onChange: (key: string | null) => void;
  /** The id of the grid this index filters, wired to `aria-controls`. */
  controls?: string;
  className?: string;
};

/**
 * The A→Z filter strip.
 *
 * A toggle button per letter that actually exists in the catalogue, plus the
 * digits, plus „Toate" to see everything again. It filters the catalogue grid
 * — it does not scroll to a card. The strip sticks under the header so the
 * letters stay reachable the whole way down the page.
 */
export function ChannelIndex<T extends ChannelLike>({
  channels,
  value,
  onChange,
  controls,
  className,
}: ChannelIndexProps<T>) {
  const buckets = alphabetBuckets(channels);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);

  if (buckets.length === 0) return null;

  // Position 0 is „Toate"; the buckets follow in alphabetical order.
  const position = value
    ? Math.max(
        0,
        buckets.findIndex((bucket) => bucket.key === value) + 1,
      )
    : 0;

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, from: number) => {
    let next = -1;
    switch (event.key) {
      case "ArrowRight":
        next = (from + 1) % (buckets.length + 1);
        break;
      case "ArrowLeft":
        next = (from - 1 + buckets.length + 1) % (buckets.length + 1);
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = buckets.length;
        break;
      default:
        return;
    }

    event.preventDefault();
    buttons.current[next]?.focus();
  };

  const chipClass = (active: boolean) =>
    cn(
      "grid h-11 min-w-11 place-items-center rounded-lg border px-2.5 font-display text-[13px] font-semibold tracking-tight transition-[background-color,color,border-color] duration-150",
      "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal",
      "motion-reduce:transition-none",
      active
        ? "border-signal/60 bg-signal/15 text-signal-bright"
        : "border-white/[0.06] bg-white/[0.03] text-ink-muted hover:border-signal/40 hover:bg-white/[0.07] hover:text-ink",
    );

  return (
    <nav
      aria-label="Index alfabetic al canalelor"
      className={cn(
        "sticky top-16 z-30 border-b border-white/[0.06] fx-glass-bar sm:top-[72px]",
        className,
      )}
    >
      <div className="mx-auto flex max-w-[1800px] items-center gap-3 px-4 sm:px-8 lg:px-12">
        <span
          aria-hidden
          className="hidden shrink-0 text-[10px] font-semibold uppercase tracking-[0.22em] text-ink-faint lg:block"
        >
          Ordonează: A–Z
        </span>
        <ul
          role="list"
          aria-controls={controls}
          className="fx-hide-scrollbar flex flex-1 items-center gap-1.5 overflow-x-auto overscroll-x-contain py-1.5"
        >
          <li>
            <button
              ref={(node) => {
                buttons.current[0] = node;
              }}
              type="button"
              onClick={() => onChange(null)}
              onKeyDown={(event) => onKeyDown(event, 0)}
              tabIndex={position === 0 ? 0 : -1}
              aria-pressed={value === null}
              title="Toate canalele"
              className={cn(chipClass(value === null), "px-4")}
            >
              Toate
            </button>
          </li>
          {buckets.map((bucket, index) => {
            const active = value === bucket.key;
            const count = plural(
              bucket.channels.length,
              "canal",
              "canale",
              "de canale",
            );
            return (
              <li key={bucket.key}>
                <button
                  ref={(node) => {
                    buttons.current[index + 1] = node;
                  }}
                  type="button"
                  onClick={() => onChange(active ? null : bucket.key)}
                  onKeyDown={(event) => onKeyDown(event, index + 1)}
                  tabIndex={position === index + 1 ? 0 : -1}
                  aria-pressed={active}
                  aria-label={`${bucket.label} — ${bucket.channels.length} ${count}`}
                  title={`${bucket.label} — ${bucket.channels.length} ${count}`}
                  className={chipClass(active)}
                >
                  {bucket.label}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
