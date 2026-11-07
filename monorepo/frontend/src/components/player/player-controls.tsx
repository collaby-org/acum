"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type FocusEvent,
  type MouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import {
  Cast,
  Lightbulb,
  LightbulbOff,
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
  Wifi,
} from "lucide-react";
import { createPortal } from "react-dom";
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
        const connectionPanelOpen = Boolean(
          document.querySelector("[data-connection-popover]"),
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

        if (
          qualityMenuOpen ||
          connectionPanelOpen ||
          pointerOverControls ||
          focusInControls
        ) {
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
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (coarsePointer || event.pointerType === "touch") return;
      showFor(DESKTOP_CHROME_IDLE_MS);
    },
    [coarsePointer, showFor],
  );

  const onPointerDownCapture = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
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

/* ------------------------------------------------------------------ *
 * Dimensiunile controlilor
 * ------------------------------------------------------------------ */

/** Toate butoanele cu pictogramă au exact 44×44 px. */
export const CONTROL = "size-11 shrink-0 p-0";

/** Pictogramele rămân compacte, chiar dacă zona de apăsare este de 44 px. */
const CONTROL_ICON = "size-[18px]";

/** Starea pe care o arată cipul de conexiune. */
type ConnectionState = "good" | "connecting" | "buffering" | "paused" | "error";

type ConnectionStatusProps = {
  state: ConnectionState;
  qualityAutomatic: boolean;
  compactActions?: ReactNode;
  onOpenChange?: (open: boolean) => void;
};

/** Lățimea panoului de stare, în pixeli de viewport. */
const CONNECTION_PANEL_WIDTH = 272;

/**
 * Cipul de conexiune.
 *
 * Nu mai este un badge lat cu textul „În direct”. În bară rămâne doar o
 * pictogramă și un punct de stare; apăsarea ei deschide explicația în
 * română, fără să consume lățimea transportului.
 */
function ConnectionStatus({
  state,
  qualityAutomatic,
  compactActions,
  onOpenChange,
}: ConnectionStatusProps) {
  const panelId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [spot, setSpot] = useState<{ top: number; left: number } | null>(null);

  const show = useCallback(
    (next: boolean) => {
      setOpen(next);
      onOpenChange?.(next);
    },
    [onOpenChange],
  );
  const close = useCallback(() => show(false), [show]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      close();
      triggerRef.current?.focus();
    };
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (
        triggerRef.current?.contains(target) ||
        panelRef.current?.contains(target)
      ) {
        return;
      }
      close();
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown, true);
    };
  }, [close, open]);

  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const trigger = triggerRef.current;
      const panel = panelRef.current;
      if (!trigger || !panel) return;
      const rect = trigger.getBoundingClientRect();
      const height = panel.offsetHeight;
      const left = Math.max(
        8,
        Math.min(
          rect.left - 32,
          window.innerWidth - CONNECTION_PANEL_WIDTH - 8,
        ),
      );
      setSpot({ top: Math.max(8, rect.top - height - 10), left });
    };
    place();
    window.addEventListener("resize", place);
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

  const copy = {
    good: {
      title: "În direct — conexiune bună",
      detail: "Fluxul live este stabil.",
      dot: "bg-live",
    },
    connecting: {
      title: "Se conectează…",
      detail: "Se pregătește fluxul live.",
      dot: "bg-signal animate-pulse",
    },
    buffering: {
      title: "Se reia…",
      detail: "Imaginea întârzie și reia de la buffer.",
      dot: "bg-signal animate-pulse",
    },
    paused: {
      title: "În direct — redare oprită",
      detail: "Fluxul este pregătit, dar imaginea este oprită.",
      dot: "bg-ink-faint",
    },
    error: {
      title: "Flux indisponibil",
      detail: "Conectarea nu a reușit. Poți încerca din nou.",
      dot: "bg-signal",
    },
  }[state];

  const panelStyle: CSSProperties = {
    top: spot?.top ?? 0,
    left: spot?.left ?? 0,
    visibility: spot ? "visible" : "hidden",
  };

  return (
    <>
      <Button
        ref={triggerRef}
        type="button"
        variant="ghost"
        size="icon"
        onClick={() => show(!open)}
        aria-label={`Conexiune: ${copy.title}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={panelId}
        title={copy.title}
        className={cn(
          "group relative size-11 shrink-0 rounded-full p-0 text-ink-muted",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal",
        )}
      >
        <span
          aria-hidden
          className={cn(
            "relative grid size-9 place-items-center rounded-full border border-white/10 bg-black/35",
            "backdrop-blur-md transition-colors duration-200 group-hover:border-white/20 group-hover:bg-black/60 group-hover:text-ink",
            open && "border-white/25 bg-black/70 text-ink",
          )}
        >
          <Wifi className="size-4" aria-hidden />
          <span
            className={cn(
              "absolute right-1.5 top-1.5 size-1.5 rounded-full ring-2 ring-black/60",
              copy.dot,
            )}
          />
        </span>
      </Button>

      {open
        ? createPortal(
            <div
              ref={panelRef}
              id={panelId}
              role="dialog"
              aria-label="Starea conexiunii"
              data-connection-popover=""
              style={panelStyle}
              className={cn(
                "fixed z-[70] max-h-[calc(100vh-1rem)] w-[272px] overflow-y-auto rounded-2xl border border-white/10",
                "bg-canvas-raised/95 p-3.5 text-ink shadow-[var(--shadow-e4)] backdrop-blur-xl",
                "animate-scale-in",
              )}
            >
              <div className="flex items-start gap-2.5">
                <span
                  aria-hidden
                  className={cn(
                    "mt-1 size-2 shrink-0 rounded-full",
                    copy.dot,
                  )}
                />
                <div className="min-w-0">
                  <p className="font-display text-[13px] font-semibold leading-snug">
                    {copy.title}
                  </p>
                  <p className="mt-1 text-[11px] leading-relaxed text-ink-muted">
                    {copy.detail}
                  </p>
                </div>
              </div>
              <div className="fx-divider my-3" />
              <div className="flex items-center justify-between gap-3">
                <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-faint">
                  {qualityAutomatic ? "Calitate automată" : "Calitate fixată"}
                </span>
                <span className="font-display text-[11px] font-semibold text-signal">
                  {qualityAutomatic ? "Auto" : "Fixată"}
                </span>
              </div>
              <p className="mt-1 text-[11px] leading-relaxed text-ink-muted">
                {qualityAutomatic
                  ? "Calitatea se alege automat după conexiune."
                  : "Calitatea rămâne fixată cât timp imaginea rulează."}
              </p>
              {compactActions ? (
                <div className="mt-3 border-t border-white/10 pt-3 min-[768px]:hidden">
                  {compactActions}
                </div>
              ) : null}
            </div>,
            document.body,
          )
        : null}
    </>
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
  /** True cât timp decoderul reia o imagine deja pornită. */
  buffering?: boolean;
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
  /** Calitatea este aleasă automat după conexiune. */
  qualityAutomatic?: boolean;
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
  /** Ține bara treaptă cât timp panoul de conexiune este deschis. */
  onConnectionOpenChange?: (open: boolean) => void;
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
  buffering = false,
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
  qualityAutomatic = true,
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
  onConnectionOpenChange,
  className,
}: PlayerControlsProps) {
  const volumeId = useId();
  const volumePercent = muted ? 0 : Math.round(Math.max(0, Math.min(1, volume)) * 100);

  const connectionState: ConnectionState = error
    ? "error"
    : buffering
      ? "buffering"
      : busy || connecting
        ? "connecting"
        : playing
          ? "good"
          : "paused";

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

  const compactActions = (
    <div className="grid grid-cols-2 gap-1.5">
      {behindLive && onJumpToLive ? (
        <Button
          type="button"
          variant="ghost"
          onClick={onJumpToLive}
          aria-label="Înapoi la direct"
          title="Înapoi la direct"
          className="h-11 min-w-0 justify-start gap-2 px-2.5 text-[10px] text-live-soft hover:bg-live/12 hover:text-live"
        >
          <LiveJump className={CONTROL_ICON} />
          <span className="truncate">La direct</span>
        </Button>
      ) : null}

      {error ? (
        <Button
          type="button"
          variant="ghost"
          onClick={onRetry}
          aria-label="Reîncearcă fluxul"
          title="Reîncearcă fluxul"
          className="h-11 min-w-0 justify-start gap-2 px-2.5 text-[10px] text-signal hover:bg-signal/12 hover:text-signal"
        >
          <RotateCcw className={CONTROL_ICON} />
          <span className="truncate">Reîncearcă</span>
        </Button>
      ) : null}

      {canSwitch && onNextSource ? (
        <Button
          type="button"
          variant="ghost"
          onClick={onNextSource}
          aria-label="Treci la următorul flux"
          title="Treci la următorul flux"
          className="h-11 min-w-0 justify-start gap-2 px-2.5 text-[10px]"
        >
          <SkipForward className={CONTROL_ICON} />
          <span className="truncate">Următorul flux</span>
        </Button>
      ) : null}

      <Button
        type="button"
        variant="ghost"
        onClick={onToggleCast}
        disabled={!canCast}
        aria-label={castLabel}
        title={castTitle}
        className="h-11 min-w-0 justify-start gap-2 px-2.5 text-[10px] disabled:cursor-not-allowed"
      >
        <Cast className={CONTROL_ICON} />
        <span className="truncate">
          {canCast ? (castConnected ? "Se redă pe TV" : "Cast TV") : "Cast TV"}
        </span>
      </Button>

      <Button
        type="button"
        variant="ghost"
        onClick={onTogglePictureInPicture}
        disabled={!pictureInPictureAvailable}
        aria-label={pictureInPictureLabel}
        title={pictureInPictureTitle}
        className="h-11 min-w-0 justify-start gap-2 px-2.5 text-[10px] disabled:cursor-not-allowed"
      >
        <PictureInPicture2 className={CONTROL_ICON} />
        <span className="truncate">PiP</span>
      </Button>

      <Button
        type="button"
        variant="ghost"
        onClick={onToggleCinema}
        disabled={!canCinema && !cinema}
        aria-label={cinemaLabel}
        title={cinemaTitle}
        className="h-11 min-w-0 justify-start gap-2 px-2.5 text-[10px] disabled:cursor-not-allowed"
      >
        {cinema ? (
          <LightbulbOff className={CONTROL_ICON} />
        ) : (
          <Lightbulb className={CONTROL_ICON} />
        )}
        <span className="truncate">Cinema</span>
      </Button>

      <Button
        type="button"
        variant="ghost"
        onClick={onToggleFullscreen}
        disabled={!canFullscreen}
        aria-label={fullscreenLabel}
        title={fullscreenTitle}
        className="h-11 min-w-0 justify-start gap-2 px-2.5 text-[10px] disabled:cursor-not-allowed"
      >
        {fullscreen ? (
          <Minimize className={CONTROL_ICON} />
        ) : (
          <Maximize className={CONTROL_ICON} />
        )}
        <span className="truncate">Fullscreen</span>
      </Button>

      {!canCast ? (
        <p className="col-span-2 mt-1 text-[10px] leading-relaxed text-ink-faint">
          Castarea pe TV nu este disponibilă în acest browser.
        </p>
      ) : null}
    </div>
  );

  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-0 z-30",
        className,
      )}
    >
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
            "flex flex-nowrap items-center gap-1.5 px-3 py-2",
            "min-[768px]:gap-2 min-[768px]:px-4",
            fullscreen
              ? "pl-[max(1rem,var(--safe-left))] pr-[max(1rem,var(--safe-right))]"
              : "pl-3 pr-3 min-[768px]:pl-4 min-[768px]:pr-4",
          )}
        >
          {/* Redarea, sunetul și volumul. */}
          <div className="flex min-w-0 items-center gap-1.5">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onTogglePlay}
              aria-label={playing ? "Pauză" : "Redare"}
              title={playing ? "Pauză" : "Redare"}
              className={cn(CONTROL, "bg-white/8 text-ink hover:bg-white/14")}
            >
              {playing ? (
                <Pause className={CONTROL_ICON} />
              ) : (
                <Play className={CONTROL_ICON} />
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

            <div className="hidden h-11 shrink-0 items-center min-[400px]:flex">
              <label htmlFor={volumeId} className="sr-only">
                Volum
              </label>
              <div className="relative h-11 w-20 shrink-0 min-[560px]:w-24">
                <div
                  aria-hidden
                  className="absolute left-0 right-0 top-1/2 h-1.5 -translate-y-1/2 overflow-hidden rounded-full bg-white/15"
                >
                  {/* The fill is inset by the radius of the dot, so the dot
                      always sits at the end of the colour and never half
                      outside the track. */}
                  <div
                    className="absolute left-[0.375rem] top-0 h-full rounded-full bg-signal"
                    style={{
                      width: `calc((100% - 0.75rem) * ${volumePercent / 100})`,
                    }}
                  />
                </div>
                <span
                  aria-hidden
                  data-player-volume-thumb=""
                  className="player-volume-thumb pointer-events-none absolute top-1/2 z-20 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink"
                  style={{
                    left: `calc(0.375rem + (100% - 0.75rem) * ${volumePercent / 100})`,
                  }}
                />
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
                    "player-volume-range absolute inset-0 z-10 h-11 w-full cursor-pointer appearance-none bg-transparent",
                    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal",
                  )}
                />
              </div>
              <span
                aria-hidden
                className="w-8 shrink-0 text-right font-mono text-[10px] tabular-nums text-ink-muted"
              >
                {volumePercent}%
              </span>
            </div>
          </div>

          {/* Toate comenzile din dreapta formează un singur grup, astfel
              încât niciun buton nu poate trece peste altul sau peste
              panoul canalului când bara apare. */}
          <div className="ml-auto flex shrink-0 items-center gap-1.5">
            {/* Conexiunea și calitatea stau împreună, dar rămân compacte. */}
            <div className="flex min-w-0 items-center gap-1.5">
              <ConnectionStatus
                state={connectionState}
                qualityAutomatic={qualityAutomatic}
                compactActions={compactActions}
                onOpenChange={onConnectionOpenChange}
              />
              {quality ? (
                <div className="shrink-0 [&>button>span]:gap-0 [&>button>span]:px-0 [&>button>span>span]:hidden [&>button>span>svg:last-child]:hidden">
                  {quality}
                </div>
              ) : null}
            </div>

          {/* Saltul la direct și recuperarea fluxului. */}
          <div className="hidden min-w-0 items-center gap-1.5 min-[768px]:flex">
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
          <div className="hidden shrink-0 items-center justify-end gap-1.5 min-[768px]:flex">
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
    </div>
  );
}
