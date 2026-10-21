"use client";

import { useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { alphabetBuckets, type ChannelLike } from "@/lib/navigation";
import { cn, plural } from "@/lib/utils";

type ChannelIndexProps<T extends ChannelLike> = {
  channels: T[];
  /** Called with the first channel of the bucket, before the jump. */
  onJumpTo?: (channel: T, bucket: string) => void;
  className?: string;
};

function reducedMotion() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * The A→Z jump bar.
 *
 * One button per letter that actually exists in the catalogue, plus the
 * digits. Clicking scrolls to the first channel of that letter and puts the
 * keyboard on it.
 */
export function ChannelIndex<T extends ChannelLike>({
  channels,
  onJumpTo,
  className,
}: ChannelIndexProps<T>) {
  const buckets = alphabetBuckets(channels);
  const [activeKey, setActiveKey] = useState<string | null>(
    buckets[0]?.key ?? null,
  );
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);

  if (buckets.length === 0) return null;

  const currentKey = buckets.some((bucket) => bucket.key === activeKey)
    ? (activeKey as string)
    : buckets[0].key;

  const jump = (bucketKey: string) => {
    const bucket = buckets.find((entry) => entry.key === bucketKey);
    const channel = bucket?.channels[0];
    if (!channel) return;

    setActiveKey(bucketKey);
    onJumpTo?.(channel, bucketKey);

    // The target may only appear after the host re-rendered (for example when
    // it expands a truncated grid), so the jump waits for the next frame.
    window.requestAnimationFrame(() => {
      const node = document.querySelector<HTMLElement>(
        `[data-channel-id="${CSS.escape(channel.id)}"]`,
      );
      node?.scrollIntoView({
        behavior: reducedMotion() ? "auto" : "smooth",
        block: "center",
      });
      node
        ?.querySelector<HTMLElement>('[data-card-action="play"]')
        ?.focus({ preventScroll: true });
    });
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, position: number) => {
    let next = -1;
    switch (event.key) {
      case "ArrowRight":
        next = (position + 1) % buckets.length;
        break;
      case "ArrowLeft":
        next = (position - 1 + buckets.length) % buckets.length;
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = buckets.length - 1;
        break;
      default:
        return;
    }

    event.preventDefault();
    const bucket = buckets[next];
    setActiveKey(bucket.key);
    buttons.current[next]?.focus();
  };

  return (
    <nav
      aria-label="Index alfabetic al canalelor"
      className={cn("w-full", className)}
    >
      <ul
        role="list"
        className="flex flex-wrap items-center gap-1.5"
      >
        {buckets.map((bucket, position) => (
          <li key={bucket.key}>
            <button
              ref={(node) => {
                buttons.current[position] = node;
              }}
              type="button"
              onClick={() => jump(bucket.key)}
              onKeyDown={(event) => onKeyDown(event, position)}
              tabIndex={currentKey === bucket.key ? 0 : -1}
              aria-label={`${bucket.label} — ${plural(bucket.channels.length, "canal", "canale", "de canale")}`}
              title={`${bucket.label} — ${plural(bucket.channels.length, "canal", "canale", "de canale")}`}
              className={cn(
                "grid h-9 min-w-9 place-items-center rounded-lg border px-2 font-display text-[13px] font-semibold tracking-tight transition-[background-color,color,border-color,transform] duration-150",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal",
                "motion-reduce:transition-none",
                currentKey === bucket.key
                  ? "border-signal/60 bg-signal/15 text-signal-bright"
                  : "border-hairline bg-white/4 text-ink-muted hover:border-signal/40 hover:bg-white/8 hover:text-ink",
              )}
            >
              {bucket.label}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
