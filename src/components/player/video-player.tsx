/**
 * The picture.
 *
 * Contract for the integrator:
 *
 *   const ref = useRef<PlayerHandle>(null);
 *   <VideoPlayer ref={ref} channelName={channel.name} channelId={channel.id} />
 *
 * The browser names the channel and nothing else: the upstream feeds, their
 * addresses and the source they come from stay on the server. The chain of
 * playable links is resolved server-side, and the component walks it by
 * itself: the first feed that plays wins, the others are the fallback.
 *
 * The imperative handle exposes `play()`, `pause()`, `retry()`, `next()` and
 * `getState()`. `play()` is what the parent calls when the modal opens, so
 * that the first click on a channel card starts the picture.
 *
 * Nothing here loads the upstream page: the stream is fetched from our own
 * `/api/stream` proxy, so the upstream player — and its ad scripts — never
 * run.
 */
"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { Loader2, Radio, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PlayerControls } from "@/components/player/player-controls";
import { MuteOverlay, SoundHint } from "@/components/player/mute-overlay";
import {
  usePlayer,
  type PlayerStatus,
} from "@/hooks/use-player";
import { cn } from "@/lib/utils";

/**
 * The video element as Safari knows it.
 *
 * iPhone Safari has no Fullscreen API for elements — only the video's own
 * native fullscreen, with the system controls.
 */
type WebkitVideoElement = HTMLVideoElement & {
  webkitEnterFullscreen?: () => void;
  webkitExitFullscreen?: () => void;
  webkitDisplayingFullscreen?: boolean;
};

/** How this browser can go full screen. */
type FullscreenMode = "element" | "video" | "none";

export type PlayerHandle = {
  /** Resolve the feed and start the picture. */
  play: () => void;
  pause: () => void;
  /** Start over from the first link of the chain. */
  retry: () => void;
  /** Move to the next link of the chain. */
  next: () => void;
  /** The state machine, for the parent that wants to render it. */
  getState: () => {
    status: PlayerStatus;
    sourceIndex: number;
    attempts: number;
  };
};

export type VideoPlayerProps = {
  /** Shown while the picture is loading and when it fails. */
  channelName: string;
  /** The channel's upstream feeds, best first. */
  channelId: string;
  /** Resolve the chain and start playing as soon as the component mounts. */
  autoPlay?: boolean;
  /** Hide the transport bar and the overlays. */
  bare?: boolean;
  className?: string;
  onStatusChange?: (status: PlayerStatus) => void;
  onError?: (message: string) => void;
};

export const VideoPlayer = forwardRef<PlayerHandle, VideoPlayerProps>(
  function VideoPlayer(
    {
      channelName,
      channelId,
      autoPlay = false,
      bare = false,
      className,
      onStatusChange,
      onError,
    },
    ref,
  ) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const shellRef = useRef<HTMLDivElement>(null);
    const [playing, setPlaying] = useState(false);
    const [muted, setMuted] = useState(true);
    const [volume, setVolume] = useState(1);
    const [fullscreen, setFullscreen] = useState(false);
    const [fullscreenMode, setFullscreenMode] = useState<FullscreenMode>("none");
    const [liveWindow, setLiveWindow] = useState<{
      from: number;
      to: number;
      current: number;
    } | null>(null);
    const [behindLive, setBehindLive] = useState(false);
    // The browser refused to start the picture: the visitor has to tap.
    const [blocked, setBlocked] = useState(false);

    const player = usePlayer({
      channelId,
      autoStart: autoPlay,
      onStatusChange,
    });
    const { source, status, sources, sourceIndex, attempts, error } = player;

    const failRef = useRef(player.markFailed);
    useEffect(() => {
      failRef.current = player.markFailed;
    }, [player.markFailed]);

    const startPlayback = useCallback(async () => {
      const video = videoRef.current;
      if (!video) return;
      try {
        await video.play();
        setBlocked(false);
      } catch {
        // The browser refused sound; the picture matters more than the audio.
        video.muted = true;
        setMuted(true);
        try {
          await video.play();
          setBlocked(false);
        } catch {
          // The browser refused the picture as well. Only a tap can start
          // it now, so the overlay goes up and waits.
          setBlocked(true);
        }
      }
    }, []);

    /**
     * The tap: a gesture is what the browser asks for, so the picture
     * starts with sound when it can.
     */
    const enableSound = useCallback(async () => {
      const video = videoRef.current;
      if (!video) return;
      video.muted = false;
      setMuted(false);
      try {
        await video.play();
        setBlocked(false);
      } catch {
        video.muted = true;
        setMuted(true);
        setBlocked(true);
      }
    }, []);

    const startPlaybackRef = useRef(startPlayback);
    useEffect(() => {
      startPlaybackRef.current = startPlayback;
    }, [startPlayback]);

    // Load the current link.
    const sourceUrl = source?.url ?? null;
    const embedded = source?.kind === "embed";
    const frameUrl = embedded ? (source?.url ?? undefined) : undefined;

    useEffect(() => {
      const video = videoRef.current;
      if (!video || !sourceUrl || embedded) return;

      // A new link gets a new chance: the previous refusal says nothing
      // about this one.
      setBlocked(false);

      let disposed = false;
      let destroy: (() => void) | null = null;

      const attach = async () => {
        const { default: Hls } = await import("hls.js");
        if (disposed) return;

        if (video.canPlayType("application/vnd.apple.mpegurl")) {
          video.src = sourceUrl;
          await startPlaybackRef.current();
          return;
        }

        if (!Hls.isSupported()) {
          failRef.current(
            "Browserul nu poate reda fluxuri HLS pe acest dispozitiv.",
          );
          return;
        }

        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
          backBufferLength: 30,
          maxBufferLength: 20,
          // A dead server has to fail over in about a second, not after the
          // default twenty-second retry ladder. The next feed of the same
          // channel is the real fallback.
          manifestLoadPolicy: {
            default: {
              maxTimeToFirstByteMs: 8000,
              maxLoadTimeMs: 12000,
              timeoutRetry: {
                maxNumRetry: 0,
                retryDelayMs: 0,
                maxRetryDelayMs: 0,
              },
              errorRetry: {
                maxNumRetry: 1,
                retryDelayMs: 400,
                maxRetryDelayMs: 800,
              },
            },
          },
        });
        destroy = () => hls.destroy();

        hls.on(Hls.Events.ERROR, (_event, data) => {
          // A manifest that will not load is a dead server: fail over at
          // once, whether or not hls.js still considers the error retryable.
          const manifestFailed =
            data.details === Hls.ErrorDetails.MANIFEST_LOAD_ERROR ||
            data.details === Hls.ErrorDetails.MANIFEST_LOAD_TIMEOUT ||
            data.details === Hls.ErrorDetails.MANIFEST_PARSING_ERROR;

          if (!data.fatal && !manifestFailed) return;

          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
            failRef.current("Fluxul nu răspunde. Se încearcă următorul.");
            return;
          }
          failRef.current("Fluxul nu poate fi redat. Se încearcă următorul.");
        });

        hls.loadSource(sourceUrl);
        hls.attachMedia(video);
        await startPlaybackRef.current();
      };

      void attach();

      return () => {
        disposed = true;
        destroy?.();
        video.removeAttribute("src");
        video.load();
      };
    }, [embedded, sourceUrl]);

    useEffect(() => {
      if (status === "error" && error) onError?.(error);
    }, [error, onError, status]);

    const markPlayingRef = useRef(player.markPlaying);
    useEffect(() => {
      markPlayingRef.current = player.markPlaying;
    }, [player.markPlaying]);

    useEffect(() => {
      if (embedded) markPlayingRef.current();
    }, [embedded]);

    useEffect(() => {
      const onChange = () => setFullscreen(Boolean(document.fullscreenElement));
      document.addEventListener("fullscreenchange", onChange);
      document.addEventListener("webkitfullscreenchange", onChange);
      return () => {
        document.removeEventListener("fullscreenchange", onChange);
        document.removeEventListener("webkitfullscreenchange", onChange);
      };
    }, []);

    // Safari's native video fullscreen has its own life: it starts and ends
    // without the document ever entering fullscreen, so the button has to
    // follow the video, not the page.
    useEffect(() => {
      const video = videoRef.current as WebkitVideoElement | null;
      if (!video) return;

      const onBegin = () => setFullscreen(true);
      const onEnd = () => setFullscreen(false);
      video.addEventListener("webkitbeginfullscreen", onBegin);
      video.addEventListener("webkitendfullscreen", onEnd);
      return () => {
        video.removeEventListener("webkitbeginfullscreen", onBegin);
        video.removeEventListener("webkitendfullscreen", onEnd);
      };
    }, []);

    // What this browser can do. iPhone Safari knows neither the element
    // Fullscreen API nor a picture-in-picture window; it knows the video's
    // own fullscreen, and that is enough.
    useEffect(() => {
      const shell = shellRef.current;
      const video = videoRef.current as WebkitVideoElement | null;

      if (shell && typeof shell.requestFullscreen === "function") {
        setFullscreenMode("element");
        return;
      }
      if (!embedded && video && typeof video.webkitEnterFullscreen === "function") {
        setFullscreenMode("video");
        return;
      }
      setFullscreenMode("none");
    }, [embedded]);

    // The live window: what the stream has buffered, and where the live edge
    // is right now. A live channel has no past to scrub into.
    useEffect(() => {
      const video = videoRef.current;
      if (!video) return;

      const read = () => {
        const ranges = video.buffered;
        if (ranges.length === 0) {
          setLiveWindow(null);
          return;
        }
        const from = ranges.start(0);
        const to = ranges.end(ranges.length - 1);
        setLiveWindow({ from, to, current: video.currentTime });
        setBehindLive(to - video.currentTime > 1.5);
      };

      read();
      const timer = window.setInterval(read, 1000);
      return () => window.clearInterval(timer);
    }, [sourceUrl]);

    useImperativeHandle(
      ref,
      () => ({
        play: () => {
          player.play();
          void startPlaybackRef.current();
        },
        pause: () => {
          videoRef.current?.pause();
          setPlaying(false);
        },
        retry: () => {
          player.retry();
        },
        next: () => {
          player.advance();
        },
        getState: () => ({
          status: player.status,
          sourceIndex: player.sourceIndex,
          attempts: player.attempts,
        }),
      }),
      [player],
    );

    const busy = status === "resolving" || status === "retrying";
    const failed = status === "error";
    const hasNext = sourceIndex + 1 < sources.length;

    const togglePlay = useCallback(() => {
      const video = videoRef.current;
      if (!video) return;
      if (video.paused) {
        void startPlaybackRef.current();
      } else {
        video.pause();
      }
    }, []);

    const toggleMute = useCallback(() => {
      const video = videoRef.current;
      if (!video) return;
      video.muted = !video.muted;
      setMuted(video.muted);
    }, []);

    const changeVolume = useCallback((value: number) => {
      const video = videoRef.current;
      if (!video) return;
      video.volume = value;
      video.muted = value === 0;
      setVolume(value);
      setMuted(video.muted);
    }, []);

    /**
     * Safari's own full screen for the video: the native player with the
     * system controls. It refuses a paused video, so the picture is started
     * first.
     */
    const enterNativeFullscreen = useCallback(() => {
      const video = videoRef.current as WebkitVideoElement | null;
      if (!video || typeof video.webkitEnterFullscreen !== "function") return;
      if (video.paused) void video.play().catch(() => undefined);
      try {
        video.webkitEnterFullscreen();
      } catch {
        /* nothing left to try */
      }
    }, []);

    const toggleFullscreen = useCallback(() => {
      const shell = shellRef.current;
      const video = videoRef.current as WebkitVideoElement | null;

      // Safari's native video fullscreen: it is its own window, and it is
      // closed through the video, not the document.
      if (video?.webkitDisplayingFullscreen) {
        video.webkitExitFullscreen?.();
        return;
      }

      if (document.fullscreenElement) {
        void document.exitFullscreen?.().catch(() => undefined);
        return;
      }

      // The element Fullscreen API, where it exists.
      if (shell && typeof shell.requestFullscreen === "function") {
        void shell.requestFullscreen().catch(() => {
          // The browser refused the request — a gesture it did not trust, a
          // permissions policy, a frame without the right allow attribute.
          // The video's own fullscreen is the way out.
          enterNativeFullscreen();
        });
        return;
      }

      // iPhone: the video goes full screen with the system controls.
      enterNativeFullscreen();
    }, [enterNativeFullscreen]);

    // Whether the browser can put the picture in a floating window is
    // only known in the browser — and the answer has to be the same on the
    // server and on the first client render, or the two trees disagree.
    // The channel page renders the player on the server, so the flag waits
    // for the mount.
    const [canPictureInPicture, setCanPictureInPicture] = useState(false);
    useEffect(() => {
      setCanPictureInPicture("pictureInPictureEnabled" in document);
    }, []);

    const togglePictureInPicture = useCallback(() => {
      const video = videoRef.current;
      if (!video || !("requestPictureInPicture" in video)) return;
      if (document.pictureInPictureElement) {
        void document.exitPictureInPicture().catch(() => undefined);
        return;
      }
      void video.requestPictureInPicture().catch(() => undefined);
    }, []);

    const seek = useCallback((time: number) => {
      const video = videoRef.current;
      if (!video) return;
      video.currentTime = time;
    }, []);

    const jumpToLive = useCallback(() => {
      const video = videoRef.current;
      if (!video || video.buffered.length === 0) return;
      video.currentTime = video.buffered.end(video.buffered.length - 1);
    }, []);

    return (
      <div
        ref={shellRef}
        className={cn(
          "relative isolate flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-black",
          className,
        )}
      >
        <div className="relative aspect-video w-full bg-black max-sm:aspect-auto max-sm:min-h-[56.25vw] max-sm:flex-1">
          <video
            ref={videoRef}
            className={cn(
              "absolute inset-0 size-full bg-black object-contain",
              embedded && "hidden",
            )}
            playsInline
            muted={muted}
            onPlaying={() => {
              setPlaying(true);
              player.markPlaying();
            }}
            onPause={() => setPlaying(false)}
            onWaiting={() => setPlaying(false)}
            onError={() => failRef.current("Fluxul nu poate fi redat.")}
          />

          {embedded ? (
            <iframe
              key={frameUrl}
              src={frameUrl}
              title={`${channelName} — live`}
              allow="autoplay; fullscreen; picture-in-picture"
              allowFullScreen
              // No `allow-popups`: an ad window can never open from here.
              sandbox="allow-scripts allow-same-origin allow-presentation"
              referrerPolicy="no-referrer-when-downgrade"
              className="absolute inset-0 size-full border-0 bg-black"
            />
          ) : null}

          {embedded ? (
            <p className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-center bg-gradient-to-b from-black/85 to-transparent px-4 py-3 text-center text-[13px] font-medium text-ink/90">
              Redarea este controlată din playerul încorporat.
            </p>
          ) : null}

          {busy && !failed && !embedded && !blocked ? (
            <div className="pointer-events-none absolute inset-0 grid place-items-center bg-black/55">
              <div className="flex flex-col items-center gap-3 text-center">
                <Loader2 className="size-7 animate-spin text-signal" />
                <p className="text-sm text-ink/85">
                  {status === "retrying"
                    ? "Se încearcă următorul flux…"
                    : "Se caută fluxul…"}
                </p>
                {attempts > 0 ? (
                  <p className="text-[11px] uppercase tracking-[0.18em] text-ink-faint">
                    încercarea {attempts + 1}
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}

          {failed ? (
            <div className="absolute inset-0 grid place-items-center bg-black/80 p-6 text-center">
              <div className="max-w-sm">
                <TriangleAlert className="mx-auto size-7 text-signal" />
                <p className="mt-3 font-display text-base font-semibold text-ink">
                  {channelName} nu poate fi redat acum
                </p>
                <p className="mt-1.5 text-[13px] leading-relaxed text-ink-muted">
                  {error ?? "Niciun flux nu a răspuns."}
                </p>
                <div className="mt-5 flex justify-center gap-2">
                  <Button variant="primary" size="sm" onClick={player.retry}>
                    Încearcă din nou
                  </Button>
                  {hasNext ? (
                    <Button variant="outline" size="sm" onClick={player.advance}>
                      Flux următor
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}

          {!busy && !failed && status === "idle" && !embedded ? (
            <div className="pointer-events-none absolute inset-0 grid place-items-center">
              <div className="flex flex-col items-center gap-2 text-ink-faint">
                <Radio className="size-6" />
                <p className="text-[11px] uppercase tracking-[0.2em]">
                  apasă redare
                </p>
              </div>
            </div>
          ) : null}

          {/* The browser held the picture back: the visitor taps, and the
              tap is the gesture the browser was waiting for. */}
          <MuteOverlay
            visible={blocked && !failed && !embedded}
            title="Apasă pentru redare"
            hint="Browserul a oprit pornirea automată. Un tap porneste imaginea."
            label="Pornește redarea"
            onStart={() => {
              void enableSound();
            }}
          />

          {/* The picture runs, but without sound: the pill says so. */}
          <SoundHint
            visible={playing && muted && !blocked && !embedded}
            onEnable={() => {
              void enableSound();
            }}
          />
        </div>

        {bare || embedded ? null : (
          <PlayerControls
            playing={playing}
            muted={muted}
            volume={volume}
            busy={busy}
            fullscreen={fullscreen}
            canFullscreen={fullscreenMode !== "none"}
            canSwitch={hasNext}
            canPictureInPicture={canPictureInPicture}
            liveWindow={liveWindow}
            behindLive={behindLive}
            onTogglePlay={togglePlay}
            onToggleMute={toggleMute}
            onVolumeChange={changeVolume}
            onToggleFullscreen={toggleFullscreen}
            onTogglePictureInPicture={togglePictureInPicture}
            onSeek={seek}
            onJumpToLive={jumpToLive}
            onRetry={player.retry}
            onNextSource={player.advance}
          />
        )}
      </div>
    );
  },
);
