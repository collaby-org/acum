"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type FocusEvent,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
} from "react";
import {
  Cast,
  Lightbulb,
  LightbulbOff,
  Loader2,
  Maximize,
  Minimize,
  Pause,
  PictureInPicture2,
  Play,
  RadioTower as LiveJump,
  RotateCcw,
  SkipForward,
  Volume2,
  VolumeX,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ *
 * Interacțiunea cu suprafața playerului
 * ------------------------------------------------------------------ */

/** Cât timp bara rămâne deschisă după ultima mișcare a mouse-ului. */
const DESKTOP_CHROME_IDLE_MS = 3000;

/** Cât timp bara rămâne deschisă după ultima atingere. */
const MOBILE_CHROME_IDLE_MS = 4000;

export type PlayerChromeProps = {
  children: ReactNode;
  className?: string;
};

/**
 * Suprafața de deasupra imaginii.
 *
 * Pe desktop, bara apare la prima mișcare a mouse-ului și se ascunde din
 * nou după trei secunde. Pe telefon, o atingere pe imagine o arată și o
 * ascunde după patru secunde; atingerea nu schimbă redarea. Doar butonul
 * de redare are voie să atingă starea playerului.
 */
export function PlayerChrome({ children, className }: PlayerChromeProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const idleTimer = useRef<number | null>(null);
  const lastPointerType = useRef("");
  const [coarsePointer, setCoarsePointer] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(hover: none), (pointer: coarse)");
    const sync = () => setCoarsePointer(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  /**
   * Reprogramează ascunderea barei.
   *
   * Pe desktop, cursorul și focusul din interiorul barei o țin deschisă:
   * un spectator care se oprește peste selectorul de calitate nu trebuie
   * să piardă meniul din mâna lui. Meniul de calitate este purtat în afara
   * playerului, deci este recunoscut separat.
   */
  const scheduleHide = useCallback(
    (delay: number) => {
      if (idleTimer.current !== null) window.clearTimeout(idleTimer.current);

      const check = () => {
        const root = rootRef.current;
        const activeElement = document.activeElement;
        const qualityMenuOpen = Boolean(
          document.querySelector("[data-quality-item]"),
        );
        const pointerOverControls = Boolean(
          !coarsePointer &&
            root?.querySelector("[data-player-controls]:hover"),
        );
        const focusInControls = Boolean(
          !coarsePointer &&
            activeElement &&
            root?.contains(activeElement),
        );

        if (qualityMenuOpen || pointerOverControls || focusInControls) {
          idleTimer.current = window.setTimeout(check, 1000);
          return;
        }

        setVisible(false);
      };

      idleTimer.current = window.setTimeout(check, delay);
    },
    [coarsePointer],
  );

  useEffect(
    () => () => {
      if (idleTimer.current !== null) window.clearTimeout(idleTimer.current);
    },
    [],
  );

  const showFor = useCallback(
    (delay: number) => {
      setVisible(true);
      scheduleHide(delay);
    },
    [scheduleHide],
  );

  const onPointerMove = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (coarsePointer || event.pointerType === "touch") return;
      showFor(DESKTOP_CHROME_IDLE_MS);
    },
    [coarsePointer, showFor],
  );

  const onPointerDownCapture = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      lastPointerType.current = event.pointerType;
      const target = event.target as HTMLElement | null;
      if (!target?.closest?.("[data-player-controls]")) return;
      showFor(
        coarsePointer ? MOBILE_CHROME_IDLE_MS : DESKTOP_CHROME_IDLE_MS,
      );
    },
    [coarsePointer, showFor],
  );

  const onControlsFocus = useCallback(
    (event: FocusEvent<HTMLDivElement>) => {
      const target = event.target as HTMLElement | null;
      if (!target?.closest?.("[data-player-controls]")) return;
      showFor(
        coarsePointer ? MOBILE_CHROME_IDLE_MS : DESKTOP_CHROME_IDLE_MS,
      );
    },
    [coarsePointer, showFor],
  );

  const onPictureClick = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      if (!coarsePointer && lastPointerType.current !== "touch") return;

      const target = event.target as HTMLElement | null;
      if (
        target?.closest?.(
          "button, a, input, select, textarea, [role='button'], [data-player-controls]",
        )
      ) {
        return;
      }

      const frame = target?.closest?.(".fx-player-frame");
      if (!frame || !rootRef.current?.contains(frame)) return;

      // A touch reveals the chrome and starts its four-second clock. It
      // never reaches the playback state: only the explicit play button is
      // allowed to start or pause the picture.
      showFor(MOBILE_CHROME_IDLE_MS);
    },
    [coarsePointer, showFor],
  );

  return (
    <div
      ref={rootRef}
      data-player-chrome=""
      data-chrome-visible={visible ? "true" : "false"}
      data-pointer-mode={coarsePointer ? "coarse" : "fine"}
      onClick={onPictureClick}
      onFocusCapture={onControlsFocus}
      onPointerDownCapture={onPointerDownCapture}
      onPointerMove={onPointerMove}
      className={cn(
        "relative touch-manipulation",
        visible && "player-chrome--visible",
        className,
      )}
    >
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Transportul playerului
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
 * Dimensiunile controlilor
 * ------------------------------------------------------------------ */

/** Toate butoanele cu pictogramă au exact 44×44 px. */
const CONTROL = "size-11 shrink-0 p-0";

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

export type PlayerControlsProps = {
  /** True cât timp imaginile sunt pe ecran. */
  playing: boolean;
  muted: boolean;
  volume: number;
  /** True cât timp playerul caută sau încearcă un flux. */
  busy?: boolean;
  /** True cât timp imaginea așteaptă primul cadru al fluxului. */
  connecting?: boolean;
  /** True când imaginea umple ecranul. */
  fullscreen?: boolean;
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
  /** True când fluxul a eșuat și spectatorul poate încerca din nou. */
  error?: boolean;
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
 * Toate comenzile stau într-o singură bară, jos, în interiorul imaginii.
 * Pe un ecran îngust, bara are două rânduri numai când nu are loc unul singur.
 */
export function PlayerControls({
  playing,
  muted,
  volume,
  busy = false,
  connecting = false,
  fullscreen = false,
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
  error = false,
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
  const liveBufferFill = liveFill(liveWindow);

  const castLabel = canCast
    ? castConnected
      ? "Se redă pe TV"
      : "Trimite imaginea pe TV"
    : "Castarea pe TV nu este disponibilă în acest browser";
  const castTitle = canCast
    ? castConnected
      ? "Imaginea se redă pe un ecran extern"
      : "Trimite imaginea pe un smart TV"
    : "Castarea pe TV necesită Chrome, Edge sau Opera";

  const cinemaLabel = canCinema
    ? "Mod cinema — stinge lumina"
    : cinema
      ? "Aprinde lumina"
      : "Mod cinema nu este disponibil în ecran complet";
  const cinemaTitle = cinema
    ? "Aprinde lumina în pagină"
    : canCinema
      ? "Mod cinema: pagina înnegrită, imaginea la fel"
      : "Ecranul complet ocupă deja toată imaginea";

  const pictureInPictureAvailable =
    canPictureInPicture && Boolean(onTogglePictureInPicture);
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
      className={cn(
        "pointer-events-none absolute inset-0 z-30",
        className,
      )}
    >
      {busy || connecting ? (
        <div className="pointer-events-none absolute inset-0 z-20 grid place-items-center px-4">
          <div
            role="status"
            aria-live="polite"
            className="inline-flex min-h-11 items-center gap-2 rounded-full bg-black/75 px-4 text-[12px] font-semibold text-ink shadow-[var(--shadow-e2)] backdrop-blur-md"
          >
            <Loader2 className="size-5 shrink-0 animate-spin text-signal" aria-hidden />
            <span>Se conectează…</span>
          </div>
        </div>
      ) : null}

      <div
        data-player-controls=""
        data-player-controls-bar=""
        role="toolbar"
        aria-label="Controlele playerului"
        className={cn(
          "player-controls-bar pointer-events-auto absolute inset-x-0 bottom-0 z-30",
          "border-t border-white/10 bg-gradient-to-t from-black/92 via-black/72 to-black/20",
          "transition-[opacity,transform] duration-300 ease-out",
          fullscreen
            ? "pb-[max(0.5rem,var(--safe-bottom))]"
            : "pb-[max(0.5rem,var(--safe-bottom))]",
        )}
      >
        {nowPlaying ? (
          <div
            data-player-now-playing=""
            className="flex min-w-0 items-center gap-x-2.5 border-b border-white/[0.06] px-3 py-2 min-[560px]:px-4"
          >
            {nowPlaying}
          </div>
        ) : null}

        <div
          className={cn(
            "flex flex-wrap items-center gap-1.5 px-3 py-2",
            "min-[560px]:flex-nowrap min-[560px]:gap-2 min-[560px]:px-4",
            fullscreen
              ? "pl-[max(1rem,var(--safe-left))] pr-[max(1rem,var(--safe-right))]"
              : "pl-3 pr-3 min-[560px]:pl-4 min-[560px]:pr-4",
          )}
        >
          {/* Redarea, sunetul și volumul. */}
          <div className="flex min-w-0 items-center gap-1.5">
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
              {muted ? (
                <VolumeX className={CONTROL_ICON} />
              ) : (
                <Volume2 className={CONTROL_ICON} />
              )}
            </Button>

            <div className="hidden h-11 min-w-0 items-center min-[400px]:flex">
              <label htmlFor={volumeId} className="sr-only">
                Volum
              </label>
              <div className="relative h-11 w-20 min-[560px]:w-24">
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
            </div>
          </div>

          {/* Starea live și calitatea. */}
          <div className="flex min-w-0 items-center gap-1.5 min-[560px]:ml-auto">
            <LiveBadge />
            <div
              role="progressbar"
              aria-label="Bufferul fluxului live"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(liveBufferFill * 100)}
              title="Bufferul fluxului live"
              className="relative h-1.5 w-10 overflow-hidden rounded-full bg-white/15"
            >
              <div
                aria-hidden
                className="h-full rounded-full bg-live transition-[width] duration-500 ease-out"
                style={{ width: `${liveBufferFill * 100}%` }}
              />
            </div>
            {quality}
          </div>

          {/* Saltul la direct și recuperarea fluxului. */}
          <div className="flex min-w-0 items-center gap-1.5">
            {behindLive && onJumpToLive ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={onJumpToLive}
                aria-label="Înapoi la direct"
                title="Înapoi la direct"
                className={cn(CONTROL, "text-live-soft hover:bg-live/12 hover:text-live")}
              >
                <LiveJump className={CONTROL_ICON} />
              </Button>
            ) : null}

            {error ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={onRetry}
                aria-label="Reîncearcă fluxul"
                title="Reîncearcă fluxul"
                className={cn(CONTROL, "text-signal hover:bg-signal/12 hover:text-signal")}
              >
                <RotateCcw className={CONTROL_ICON} />
              </Button>
            ) : null}

            {canSwitch && onNextSource ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={onNextSource}
                aria-label="Treci la următorul flux"
                title="Treci la următorul flux"
                className={CONTROL}
              >
                <SkipForward className={CONTROL_ICON} />
              </Button>
            ) : null}
          </div>

          {/* Comenziile pentru imagine și pentru ecran. */}
          <div className="flex shrink-0 items-center justify-end gap-1.5">
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
