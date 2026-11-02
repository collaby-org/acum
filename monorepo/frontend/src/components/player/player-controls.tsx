"use client";

import { useId, type ReactNode } from "react";
import {
  Cast,
  Lightbulb,
  LightbulbOff,
  Maximize,
  Minimize,
  Pause,
  PictureInPicture2,
  Play,
  RotateCcw,
  SkipForward,
  Volume2,
  VolumeX,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ *
 *Transportul playerului
 * ------------------------------------------------------------------ */

/** Fereastra fluxului live pe care spectatorul o poate vedea. */
export type LiveWindow = {
  /** Începutul ferestrei tamponate, în secunde de flux. */
  from: number;
  /** Capătul ferestrei tamponate — marginea live, în secunde de flux. */
  to: number;
  /** Poziția curentă în flux, în secunde de flux. */
  current: number;
};

/** Tamponul live cerut de hls.js, în secunde. */
const LIVE_BUFFER_TARGET = 30;

/**
 * Cât de plină este linia live, între 0 și 1.
 *
 * Un flux live nu are o durată în care spectatorul s-ar putea deplasa, deci
 * bara nu trebuie să pretindă că este un scrubber pentru înregistrări. Linia
 * arată doar cât de mult s-a descărcat înaintea imaginii.
 */
export function liveFill(liveWindow: LiveWindow | null | undefined): number {
  if (!liveWindow) return 0;
  const ahead = liveWindow.to - liveWindow.current;
  if (!Number.isFinite(ahead) || ahead <= 0) return 0;
  return Math.min(1, ahead / LIVE_BUFFER_TARGET);
}

/* ------------------------------------------------------------------ *
 *Dimensiunile controlilor
 * ------------------------------------------------------------------ */

/** Toate butoanele cu pictogramă au exact 44×44 px. */
const CONTROL = "size-11 shrink-0 p-0";

/** Toate cipurile cu etichetă au aceeași înălțime de 44 px. */
const CONTROL_PILL = "h-11 shrink-0 px-3.5";

/** Pictogramele rămân compacte, chiar dacă zona de apăsare este de 44 px. */
const CONTROL_ICON = "size-[18px]";
const CONTROL_ICON_LEAD = "size-5";

/**
 * Marcajul de direct.
 *
 * Este o informație, nu un control, deci păstrează o formă compactă. Textul
 * este în limba română și spune exact ce este: „În direct”.
 */
export function LiveBadge({ className }: { className?: string }) {
  return (
    <span
      data-slot="live-badge"
      className={cn(
        "inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full bg-live/12 pl-1.5 pr-2",
        className,
      )}
    >
      <span className="relative grid size-2 place-items-center">
        <span aria-hidden className="fx-live-eye fx-live-eye-pulse absolute inset-0" />
        <span aria-hidden className="relative size-2 rounded-full bg-live" />
      </span>
      <span className="font-display text-[10px] font-semibold uppercase tracking-[0.14em] text-live-soft">
        În direct
      </span>
    </span>
  );
}

export type LiveBarProps = {
  /** Cât de plină este linia, între 0 și 1. */
  fill: number;
  className?: string;
};

/**
 * Linia live.
 *
 * Nu este interactivă: la marginea live nu există o poziție în care
 * spectatorul să se poată deplasa. Ea spune, în schimb, cât de sănătoasă
 * este legătura, prin tamponul aflat înaintea imaginii.
 */
function LiveBar({ fill, className }: LiveBarProps) {
  const width = Math.max(0, Math.min(1, fill)) * 100;

  return (
    <div className={cn("flex min-w-0 flex-1 items-center", className)}>
      <div
        role="progressbar"
        aria-label="Bufferul fluxului live"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(width)}
        title="Bufferul fluxului live"
        className="relative h-1.5 w-full rounded-full bg-white/15"
      >
        <div
          aria-hidden
          className={cn(
            "absolute inset-y-0 left-0 rounded-full bg-signal",
            "shadow-[0_0_14px_rgb(242_167_27/0.5)] transition-[width] duration-500 ease-out",
          )}
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
}

/** Butonul care readuce spectatorul la marginea live. */
function LiveJump({ onJump, className }: { onJump: () => void; className?: string }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={onJump}
      aria-label="Înapoi la direct"
      title="Înapoi la direct"
      className={cn(
        CONTROL_PILL,
        "gap-1.5 text-live-soft hover:bg-live/12 hover:text-live",
        className,
      )}
    >
      <span className="relative grid size-2 place-items-center">
        <span aria-hidden className="fx-live-eye absolute inset-0" />
        <span aria-hidden className="relative size-2 rounded-full bg-live" />
      </span>
      <span className="font-display text-[10px] font-semibold uppercase tracking-[0.12em]">
        <span className="sm:hidden">Direct</span>
        <span className="hidden sm:inline">Înapoi la direct</span>
      </span>
    </Button>
  );
}

export type PlayerControlsProps = {
  /** True cât timp imaginile sunt pe ecran. */
  playing: boolean;
  muted: boolean;
  volume: number;
  /** True cât timp playerul caută sau încearcă un flux. */
  busy?: boolean;
  /** True când imaginea umple ecranul. */
  fullscreen?: boolean;
  /** True când bara este adormită și nu trebuie folosită. */
  asleep?: boolean;
  /** False când browserul nu poate intra în ecran complet. */
  canFullscreen?: boolean;
  /** True când există un alt flux disponibil. */
  canSwitch?: boolean;
  /** True când browserul poate afișa imaginea într-o fereastră flotantă. */
  canPictureInPicture?: boolean;
  /** True când imaginea este deja într-o fereastră flotantă. */
  pictureInPictureActive?: boolean;
  /** True când browserul are Remote Playback API pentru un smart TV. */
  canCast?: boolean;
  /** True când un smart TV redă imaginea. */
  castConnected?: boolean;
  /** True când luminile din pagină sunt stinse. */
  cinema?: boolean;
  /** False când nu există nimic de întunecat. */
  canCinema?: boolean;
  /** True când spectatorul se află în spatele marginii live. */
  behindLive?: boolean;
  /** Ce a descărcat fluxul și unde este marginea live. */
  liveWindow?: LiveWindow | null;
  /** Ce rulează acum înaintea transportului. */
  nowPlaying?: ReactNode;
  /** Cipul de calitate, în dreapta liniei live. */
  quality?: ReactNode;
  onTogglePlay: () => void;
  onToggleMute: () => void;
  onVolumeChange: (value: number) => void;
  onToggleFullscreen: () => void;
  onTogglePictureInPicture?: () => void;
  /** Deschide selectorul nativ al browserului pentru ecrane externe. */
  onToggleCast?: () => void;
  onToggleCinema?: () => void;
  onJumpToLive?: () => void;
  onRetry: () => void;
  onNextSource?: () => void;
  className?: string;
};

/**
 * Bara de transport.
 *
 * Gruparea este gândită de la cea mai mare acțiune spre cele secundare: pe
 * mobil, redarea și sunetul stau singure, starea live are propria linie, iar
 * reluarea și comenzile pentru imagine stau la rândul lor. Pe desktop, toate
 * grupurile se așază pe un singur rând.
 */
export function PlayerControls({
  playing,
  muted,
  volume,
  busy = false,
  fullscreen = false,
  asleep = false,
  canFullscreen = true,
  canSwitch = false,
  canPictureInPicture = false,
  pictureInPictureActive = false,
  canCast = false,
  castConnected = false,
  cinema = false,
  canCinema = false,
  behindLive = false,
  liveWindow = null,
  nowPlaying,
  quality,
  onTogglePlay,
  onToggleMute,
  onVolumeChange,
  onToggleFullscreen,
  onTogglePictureInPicture,
  onToggleCast,
  onToggleCinema,
  onJumpToLive,
  onRetry,
  onNextSource,
  className,
}: PlayerControlsProps) {
  const volumeId = useId();
  const volumePercent = muted ? 0 : Math.round(Math.max(0, Math.min(1, volume)) * 100);

  const castLabel = canCast
    ? castConnected
      ? "Se redă pe TV"
      : "Trimite pe TV"
    : "Castarea pe TV nu este disponibilă în acest browser";
  const castTitle = canCast
    ? castConnected
      ? "Se redă pe un ecran extern"
      : "Trimite imaginea pe un smart TV"
    : "Castarea pe TV necesită Chrome, Edge sau Opera";

  const pictureInPictureAvailable = canPictureInPicture && Boolean(onTogglePictureInPicture);
  const pictureInPictureLabel = pictureInPictureAvailable
    ? pictureInPictureActive
      ? "Ieși din imaginea flotantă"
      : "Deschide imaginea într-o fereastră flotantă"
    : "Imaginea într-o fereastră flotantă nu este disponibilă în acest browser";
  const pictureInPictureTitle = pictureInPictureAvailable
    ? pictureInPictureActive
      ? "Înapoi la imaginea din player"
      : "Continuă redarea într-o fereastră flotantă"
    : "Browserul nu permite redarea într-o fereastră flotantă";

  const cinemaLabel = cinema
    ? "Aprinde lumina"
    : canCinema
      ? "Mod cinema — stinge lumina"
      : "Mod cinema nu este disponibil în ecran complet";
  const cinemaTitle = cinema
    ? "Aprinde lumina în pagină"
    : canCinema
      ? "Mod cinema: pagina înnegrită, imaginea la fel"
      : "Ecranul complet ocupă deja toată imaginea";

  const fullscreenLabel = canFullscreen
    ? fullscreen
      ? "Ieși din ecran complet"
      : "Ecran complet"
    : "Ecran complet nu este disponibil în acest browser";
  const fullscreenTitle = canFullscreen
    ? fullscreen
      ? "Ieși din ecran complet"
      : "Afișează imaginea pe tot ecranul"
    : "Browserul nu permite afișarea în ecran complet";

  return (
    <div
      data-player-controls=""
      className={cn(
        "flex flex-col transition-opacity duration-300",
        fullscreen
          ? "absolute inset-x-0 bottom-0 z-30 border-t-0 bg-gradient-to-t from-black/85 via-black/55 to-transparent pb-[max(1.25rem,env(safe-area-inset-bottom))]"
          : "border-t border-white/8 bg-canvas-raised max-sm:pb-[max(0.625rem,env(safe-area-inset-bottom))]",
        asleep && "pointer-events-none opacity-0",
        className,
      )}
    >
      {nowPlaying ? (
        <div className="flex min-w-0 items-center gap-x-2.5 px-3 pt-2.5 sm:px-4 sm:pt-3">
          {nowPlaying}
        </div>
      ) : null}

      <div
        className={cn(
          "grid grid-cols-2 items-center gap-x-2 gap-y-2 px-3 pb-2.5 sm:px-4",
          "xl:grid-cols-[auto_minmax(220px,1fr)_auto] xl:gap-x-3",
          nowPlaying ? "pt-1.5" : "pt-2.5",
        )}
      >
        {/* Starea live: pe mobil are un rând propriu, iar pe desktop ocupă
            partea care rămâne între transport și comenzile pentru imagine. */}
        <div className="order-1 col-span-2 flex min-w-0 items-center gap-2.5 xl:order-2 xl:col-span-1">
          <LiveBadge />
          <LiveBar fill={liveFill(liveWindow)} />
          {quality}
          {behindLive && onJumpToLive ? <LiveJump onJump={onJumpToLive} /> : null}
        </div>

        {/* Acțiunile principale. */}
        <div className="order-2 col-span-2 flex min-w-0 items-center gap-2 xl:order-1 xl:col-span-1">
          <Button
            type="button"
            variant="primary"
            size="icon"
            onClick={onTogglePlay}
            aria-label={playing ? "Pauză" : "Redare"}
            title={playing ? "Pauză" : "Redare"}
            className={CONTROL}
          >
            {playing ? (
              <Pause className={CONTROL_ICON_LEAD} />
            ) : (
              <Play className={CONTROL_ICON_LEAD} />
            )}
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onToggleMute}
            aria-label={muted ? "Pornește sunetul" : "Dezactivează sunetul"}
            aria-pressed={muted}
            title={muted ? "Pornește sunetul" : "Dezactivează sunetul"}
            className={cn(CONTROL, muted && "bg-white/8 text-ink")}
          >
            {muted ? <VolumeX className={CONTROL_ICON} /> : <Volume2 className={CONTROL_ICON} />}
          </Button>

          <div className="flex h-11 min-w-0 items-center gap-2">
            <label htmlFor={volumeId} className="sr-only">
              Volum
            </label>
            <div className="relative h-11 w-24 sm:w-28">
              <div
                aria-hidden
                className="absolute left-0 right-0 top-1/2 h-1.5 -translate-y-1/2 overflow-hidden rounded-full bg-white/15"
              >
                <div
                  className="h-full rounded-full bg-signal"
                  style={{ width: `${volumePercent}%` }}
                />
              </div>
              <input
                id={volumeId}
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={muted ? 0 : volume}
                onChange={(event) => onVolumeChange(Number(event.target.value))}
                aria-label={`Volum: ${volumePercent}%`}
                aria-valuetext={`${volumePercent}%`}
                className={cn(
                  "absolute inset-0 z-10 h-11 w-full cursor-pointer appearance-none bg-transparent",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal",
                  "[&::-moz-range-track]:h-1.5 [&::-moz-range-track]:bg-transparent",
                  "[&::-moz-range-thumb]:size-6 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-ink [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:shadow-md",
                  "[&::-webkit-slider-runnable-track]:h-1.5 [&::-webkit-slider-runnable-track]:bg-transparent",
                  "[&::-webkit-slider-thumb]:size-6 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-ink [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-md",
                )}
              />
            </div>
            <span
              aria-hidden
              className="w-9 shrink-0 text-right text-[11px] font-medium tabular-nums text-ink-muted"
            >
              {volumePercent}%
            </span>
          </div>
        </div>

        {/* Reluarea, următorul flux și comenzile pentru imagine. */}
        <div className="order-3 col-span-2 flex min-w-0 items-center gap-2 xl:order-3 xl:col-span-1 xl:justify-self-end">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onRetry}
            disabled={busy}
            aria-label={busy ? "Se încearcă fluxul" : "Reîncearcă fluxul"}
            title={busy ? "Se încearcă fluxul" : "Reîncearcă fluxul"}
            className={CONTROL}
          >
            <RotateCcw className={cn(CONTROL_ICON, busy && "animate-spin")} />
          </Button>

          {canSwitch && onNextSource ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onNextSource}
              aria-label="Treci la următorul flux"
              title="Treci la următorul flux"
              className={cn(CONTROL_PILL, "gap-1.5")}
            >
              <SkipForward className={CONTROL_ICON} />
              <span className="hidden xl:inline">Flux următor</span>
            </Button>
          ) : null}

          <div className="ml-auto flex shrink-0 items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onToggleCast}
              disabled={!canCast}
              aria-label={castLabel}
              aria-pressed={canCast ? castConnected : undefined}
              title={castTitle}
              className={cn(
                CONTROL,
                "disabled:cursor-not-allowed",
                castConnected && "bg-signal/12 text-signal",
              )}
            >
              <Cast className={CONTROL_ICON} />
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onTogglePictureInPicture}
              disabled={!pictureInPictureAvailable}
              aria-label={pictureInPictureLabel}
              aria-pressed={pictureInPictureAvailable ? pictureInPictureActive : undefined}
              title={pictureInPictureTitle}
              className={cn(
                CONTROL,
                "disabled:cursor-not-allowed",
                pictureInPictureActive && "bg-signal/12 text-signal",
              )}
            >
              <PictureInPicture2 className={CONTROL_ICON} />
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onToggleCinema}
              disabled={!canCinema && !cinema}
              aria-label={cinemaLabel}
              aria-pressed={cinema}
              title={cinemaTitle}
              className={cn(
                CONTROL,
                "disabled:cursor-not-allowed",
                cinema && "bg-signal/12 text-signal",
              )}
            >
              {cinema ? (
                <LightbulbOff className={CONTROL_ICON} />
              ) : (
                <Lightbulb className={CONTROL_ICON} />
              )}
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onToggleFullscreen}
              disabled={!canFullscreen}
              aria-label={fullscreenLabel}
              aria-pressed={canFullscreen ? fullscreen : undefined}
              title={fullscreenTitle}
              className={cn(
                CONTROL,
                "disabled:cursor-not-allowed",
                fullscreen && "bg-signal/12 text-signal",
              )}
            >
              {fullscreen ? (
                <Minimize className={CONTROL_ICON} />
              ) : (
                <Maximize className={CONTROL_ICON} />
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
