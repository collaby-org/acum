/**
 * The plan's own refusal.
 *
 * Two situations, and neither is the wall. The wall is the day's allowance,
 * and the paywall answers it. These are about screens:
 *
 *   - `stream_limit` — the plan is already playing on as many screens as it
 *     carries. The way out is to close one, or to move to a plan with more.
 *   - `verify_device` — a household plan is being opened on a device that is
 *     not the house's. The way out is to confirm it, once, deliberately.
 *
 * The panel says what happened in one sentence and offers exactly the two
 * actions that can follow. It never mentions the stream, the feed or the
 * source: the account is the subject.
 */
"use client";

import Link from "next/link";
import { MonitorSmartphone, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { StreamBlock } from "@/hooks/use-player";

export type StreamNoticeProps = {
  /** What the server refused, or null when it refused nothing. */
  block: StreamBlock | null;
  /** Confirm this device as the household's screen. */
  onConfirm: () => void | Promise<void>;
  /** Ask the server again — a screen may have been closed since. */
  onRetry: () => void;
};

export function StreamNotice({ block, onConfirm, onRetry }: StreamNoticeProps) {
  if (!block) return null;

  const device = block.reason === "verify_device";

  return (
    <div
      data-slot="stream-notice"
      role="alertdialog"
      aria-label={device ? "Confirmă dispozitivul casei" : "Limita planului"}
      className="absolute inset-0 z-[35] grid place-items-center overflow-y-auto rounded-2xl bg-black/[0.86] p-4 backdrop-blur-[3px]"
    >
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-canvas-raised/95 p-5 text-center shadow-[var(--shadow-e4)]">
        {device ? (
          <MonitorSmartphone className="mx-auto size-6 text-signal" aria-hidden />
        ) : (
          <Users className="mx-auto size-6 text-signal" aria-hidden />
        )}

        <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-signal/85">
          {device ? "Casa ta" : "Planul tău"}
        </p>

        <h2 className="mt-2 font-display text-[17px] font-semibold leading-snug tracking-[-0.01em] text-ink">
          {device ? "Confirmă acest dispozitiv" : "Prea multe ecrane deodată"}
        </h2>

        <p className="mt-2 text-[13px] leading-relaxed text-ink-muted">
          {block.message}
        </p>

        <div className="mt-5 flex flex-col gap-2">
          {device ? (
            <Button variant="primary" size="sm" onClick={() => void onConfirm()}>
              Confirmă dispozitivul
            </Button>
          ) : (
            <Button variant="primary" size="sm" onClick={onRetry}>
              Reîncearcă
            </Button>
          )}

          <Link
            href="/preturi"
            className="text-[12px] text-ink-faint underline underline-offset-4 transition-colors duration-300 hover:text-ink"
          >
            Vezi planurile
          </Link>
        </div>
      </div>
    </div>
  );
}
