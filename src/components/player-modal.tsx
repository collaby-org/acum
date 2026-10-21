"use client";

import { useState } from "react";
import Image from "next/image";
import {
  ExternalLink,
  Heart,
  Link2,
  Play,
  Radio,
  Check,
  TriangleAlert,
} from "lucide-react";
import type { Channel } from "@/data/channels";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { STATUS_META, posterPalette } from "@/lib/channel-meta";
import { cn } from "@/lib/utils";

type PlayerModalProps = {
  channel: Channel | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isFavorite: boolean;
  onToggleFavorite: (channel: Channel) => void;
};

export function PlayerModal({
  channel,
  open,
  onOpenChange,
  isFavorite,
  onToggleFavorite,
}: PlayerModalProps) {
  if (!channel) return null;

  const palette = posterPalette(channel.familyKey, channel.category);
  const status = STATUS_META[channel.status];
  const playable = channel.status === "live";
  const embeddable = Boolean(channel.embedUrl);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        hideClose
        className="overflow-hidden rounded-2xl border border-white/10 bg-canvas-raised shadow-[0_40px_120px_-30px_rgba(0,0,0,1)]"
      >
        <DialogTitle className="sr-only">{channel.name}</DialogTitle>
        <DialogDescription className="sr-only">
          Player live pentru {channel.name}
        </DialogDescription>

        {/* Player stage */}
        <div className="relative aspect-video w-full bg-black">
          {embeddable ? (
            <>
              <iframe
                key={channel.id}
                src={channel.embedUrl ?? undefined}
                title={`${channel.name} — live`}
                allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
                allowFullScreen
                referrerPolicy="no-referrer-when-downgrade"
                className="absolute inset-0 size-full border-0 bg-black"
              />
              {!playable && (
                <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-start gap-2.5 bg-gradient-to-t from-black/92 via-black/70 to-transparent p-4">
                  <TriangleAlert className="mt-0.5 size-4 shrink-0 text-signal" />
                  <p className="text-[13px] leading-snug text-ink/85">
                    {status.hint}
                  </p>
                </div>
              )}
            </>
          ) : (
            <div
              className="absolute inset-0 grid place-items-center p-8 text-center"
              style={{
                background: `radial-gradient(120% 100% at 50% 0%, ${palette.from} 0%, transparent 65%), linear-gradient(160deg, ${palette.via}, ${palette.to})`,
              }}
            >
              <div className="max-w-md">
                <Radio className="mx-auto size-8 text-ink-faint" />
                <p className="mt-4 text-sm leading-relaxed text-ink-muted">
                  {status.hint} Canalul rămâne listat pentru completitudine, dar nu poate
                  fi redat în browser.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Meta bar */}
        <div className="flex flex-col gap-4 border-t border-white/8 bg-canvas-raised p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                {playable ? (
                  <Badge variant="live" size="xs">
                    <span className="size-1.5 animate-[pulse-live_1.9s_ease-in-out_infinite] rounded-full bg-live" />
                    În direct
                  </Badge>
                ) : (
                  <Badge variant="outline" size="xs">
                    {status.label}
                  </Badge>
                )}
                <Badge variant="default" size="xs">
                  {channel.family}
                </Badge>
              </div>
              <h3 className="flex items-center gap-3 font-display text-2xl font-semibold tracking-tight">
                {channel.logo && (
                  <span className="flex h-8 items-center rounded-md bg-black/50 px-1.5">
                    <Image
                      src={channel.logo}
                      alt=""
                      width={40}
                      height={20}
                      className="h-5 w-10 object-contain"
                      unoptimized
                    />
                  </span>
                )}
                {channel.name}
              </h3>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <Button
                variant={isFavorite ? "primary" : "secondary"}
                size="sm"
                onClick={() => onToggleFavorite(channel)}
                aria-pressed={isFavorite}
              >
                <Heart className={cn("size-4", isFavorite && "fill-current")} />
                {isFavorite ? "Salvat" : "Adaugă la favorite"}
              </Button>
              <CopyEmbedButton key={channel.id} url={channel.embedUrl} />
              <Button asChild variant="ghost" size="icon-sm">
                <a
                  href={channel.sourcePage}
                  target="_blank"
                  rel="noreferrer noopener"
                  aria-label="Deschide pagina sursă"
                  title="Deschide pagina sursă"
                >
                  <ExternalLink className="size-4" />
                </a>
              </Button>
            </div>
          </div>

          {channel.embedUrl && (
            <p className="truncate rounded-lg border border-white/6 bg-black/40 px-3 py-2 font-mono text-[11px] text-ink-faint">
              {channel.embedUrl}
            </p>
          )}

          {!playable && embeddable && (
            <Button variant="outline" size="sm" className="self-start" asChild>
              <a
                href={channel.sourcePage}
                target="_blank"
                rel="noreferrer noopener"
              >
                <Play className="size-3.5" />
                Încearcă din pagina sursă
              </a>
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Copies the raw embed URL. The component is keyed by channel, so switching
 * channels resets the "copied" state without an effect.
 */
function CopyEmbedButton({ url }: { url: string | null }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked */
    }
  };

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={copy}
      disabled={!url}
      aria-label="Copiază linkul de încorporare"
      title="Copiază linkul de încorporare"
    >
      {copied ? (
        <Check className="size-4 text-signal" />
      ) : (
        <Link2 className="size-4" />
      )}
    </Button>
  );
}
