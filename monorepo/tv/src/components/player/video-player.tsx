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
import type { CSSProperties } from "react";
import { Loader2, Radio, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PlayerControls } from "@/components/player/player-controls";
import {
  PlayerQualityBadge,
  type QualityVariant,
} from "@/components/player/player-quality";
import { MinutesWarning } from "@/components/player/minutes-warning";
import { StreamNotice } from "@/components/player/stream-notice";
import { MuteOverlay, SoundHint } from "@/components/player/mute-overlay";
import { Paywall } from "@/components/player/paywall";
import { ProgrammeBadges } from "@/components/player/programme-badges";
import {
  usePlayer,
  type PlayerStatus,
} from "@/hooks/use-player";
import { useAccount, useWatchClock } from "@/hooks/use-account";
import { useMinuteTick } from "@/hooks/use-guide-clock";
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

/**
 * The hls.js instance as TypeScript sees it.
 *
 * The library itself is only ever imported inside the browser; here
 * nothing but its type is needed — for the ref the recovery paths reach
 * for while the picture is on screen.
 */
type HlsInstance = import("hls.js").default;

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
    /** The hls.js instance driving the picture right now, if any. */
    const hlsRef = useRef<HlsInstance | null>(null);
    const [playing, setPlaying] = useState(false);
    const [muted, setMuted] = useState(true);
    const [volume, setVolume] = useState(1);
    const [fullscreen, setFullscreen] = useState(false);
    const [fullscreenMode, setFullscreenMode] = useState<FullscreenMode>("none");
    // Fullscreen only: the transport bar steps aside while the picture
    // runs, and comes back at the first move of the pointer.
    const [controlsAsleep, setControlsAsleep] = useState(false);
    /**
     * The stream's own shape, read off the picture when it arrives.
     *
     * The frame takes it: a 16:9 feed gets a 16:9 frame, a 4:3 feed keeps
     * its proportions. The picture is never stretched into a box it does
     * not belong to, and in the window it is never blown up past its own
     * pixels — a 720p feed on a big screen stays 720p wide and sharp, and
     * the chrome around it grows instead. Fullscreen is the one exception:
     * there the cap drops and the picture fills the screen.
     */
    const [stream, setStream] = useState<{
      width: number;
      height: number;
    } | null>(null);
    const [liveWindow, setLiveWindow] = useState<{
      from: number;
      to: number;
      current: number;
    } | null>(null);
    const [behindLive, setBehindLive] = useState(false);
    // The ladder the manifest carries, and the rung in use right now. Both
    // belong to the hls.js instance, and both are read off it — see the
    // instance's own effect below.
    const [qualityLevels, setQualityLevels] = useState<QualityVariant[]>([]);
    const [currentLevel, setCurrentLevel] = useState(-1);
    // The browser refused to start the picture: the visitor has to tap.
    const [blocked, setBlocked] = useState(false);

    // The account decides whether the picture may play at all. The free
    // plan has two hours a day and the server is the one that counts them,
    // so the browser only asks what the answer is and obeys it.
    const account = useAccount();
    const gated = account.ready && account.gated;

    // The guard the imperative handle reads: the handle is created once,
    // and the answer may change while the picture is on screen.
    const gatedRef = useRef(gated);
    useEffect(() => {
      gatedRef.current = gated;
    }, [gated]);

    // The wall goes up while the picture runs: the video stops, and it
    // starts again on its own when the account may watch.
    useEffect(() => {
      if (!gated) return;
      const video = videoRef.current;
      if (video && !video.paused) video.pause();
    }, [gated]);

    const player = usePlayer({
      channelId,
      // The chain of links is only asked for when the account may watch.
      // A visitor behind the wall does not even learn that the channel
      // has more than one feed.
      autoStart: autoPlay && account.ready && !gated,
      onStatusChange,
    });
    const { source, status, sources, sourceIndex, attempts, error, block, confirmDevice, retry } =
      player;

    // The watch clock: the player knows how long it has been playing, and
    // the server counts it.
    useWatchClock({
      channelId,
      playing: playing && !gated,
      signedIn: account.signedIn,
      onReport: (seconds) => {
        void account.report(channelId, seconds);
      },
    });

    const failRef = useRef(player.markFailed);
    useEffect(() => {
      failRef.current = player.markFailed;
    }, [player.markFailed]);

    const startPlayback = useCallback(async () => {
      const video = videoRef.current;
      if (!video) return;
      // Behind the wall, the picture does not start. Not muted, not
      // paused later — it simply never begins.
      if (gatedRef.current) return;
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
      if (gatedRef.current) return;
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

    /**
     * The size of the picture, when the browser knows it.
     *
     * It is read from the metadata, so it is the stream's real shape and
     * not an assumption. The frame follows it; the picture is then cropped
     * to fill the frame instead of being stretched or letterboxed.
     */
    const readStreamSize = useCallback(() => {
      const video = videoRef.current;
      if (!video || !video.videoWidth || !video.videoHeight) return;
      setStream((prev) =>
        prev &&
        prev.width === video.videoWidth &&
        prev.height === video.videoHeight
          ? prev
          : { width: video.videoWidth, height: video.videoHeight },
      );
    }, []);

    // The stream may change its own shape in flight: a quality switch
    // rewrites videoWidth/videoHeight, and the frame follows — so the
    // pixel cap never sits on a size the picture has left behind.
    useEffect(() => {
      const video = videoRef.current;
      if (!video) return;
      video.addEventListener("resize", readStreamSize);
      return () => video.removeEventListener("resize", readStreamSize);
    }, [readStreamSize]);

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
      // The ladder belongs to the instance that is about to be built: until
      // its manifest is parsed there is no quality to name and none to
      // choose, so the badge stays away.
      setQualityLevels([]);
      setCurrentLevel(-1);

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

        // One failure moves the chain on — and only after the instance
        // has tried to mend itself in place. A second error out of the
        // same dying instance must never skip a feed.
        let mediaRecoveries = 0;
        let networkRecoveries = 0;
        let failedOver = false;

        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
          backBufferLength: 30,
          // A slow line needs slack in front of the picture: thirty
          // seconds of forward buffer means a hiccup has to outlast the
          // whole buffer before the picture stops at all, and when it
          // does stop, the watchdog nudges the loader back to work.
          maxBufferLength: 30,
          // The target sits three segments behind the edge, pinned — not
          // the playlist's own hold-back, which may promise half a
          // second of latency that a slow connection cannot keep and
          // then stall on. This is the only latency knob set: hls.js
          // refuses a config that mixes count and duration forms.
          liveSyncDurationCount: 3,
          // When the picture still drifts back from that target, hls.js
          // may walk it home slightly faster — never past this rate, and
          // never while the buffer is empty, so it cannot deepen a
          // stall. A scrub deeper than the target's own reach — target
          // plus one segment — counts as DVR and keeps normal speed; only
          // „Înapoi la direct” brings the viewer forward again.
          maxLiveSyncPlaybackRate: 1.5,
          // Quality follows the connection, never the size of the box —
          // fullscreen included.
          capLevelToPlayerSize: false,
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
        hlsRef.current = hls;

        /**
         * The ladder the manifest carries, and the rung in use.
         *
         * The list only exists once the manifest has been parsed, and the
         * rung moves under the viewer as the connection decides — so both
         * are read again on every switch. That is what keeps the badge
         * honest. `-1` is hls.js choosing for itself.
         */
        const readLevels = () => {
          setQualityLevels(
            hls.levels.map((level, index) => ({
              index,
              width: level.width,
              height: level.height,
              bitrate: level.bitrate,
            })),
          );
          setCurrentLevel(hls.currentLevel);
        };

        hls.on(Hls.Events.MANIFEST_PARSED, readLevels);
        hls.on(Hls.Events.LEVEL_SWITCHED, readLevels);

        let tornDown = false;
        destroy = () => {
          if (tornDown) return;
          tornDown = true;
          hls.off(Hls.Events.MANIFEST_PARSED, readLevels);
          hls.off(Hls.Events.LEVEL_SWITCHED, readLevels);
          if (hlsRef.current === hls) hlsRef.current = null;
          hls.destroy();
        };

        hls.on(Hls.Events.ERROR, (_event, data) => {
          // A manifest that will not load is a dead server: fail over at
          // once, whether or not hls.js still considers the error retryable.
          const manifestFailed =
            data.details === Hls.ErrorDetails.MANIFEST_LOAD_ERROR ||
            data.details === Hls.ErrorDetails.MANIFEST_LOAD_TIMEOUT ||
            data.details === Hls.ErrorDetails.MANIFEST_PARSING_ERROR;

          if (!data.fatal && !manifestFailed) return;
          if (failedOver) return;

          // Mend in place first. A media error is the decoder wedged:
          // restart it, and swap the audio codec if the plain restart
          // keeps failing. A network error is a loader that stopped:
          // ask it to pull again. Only when the same error comes back
          // does the chain move to the next feed.
          if (!manifestFailed && data.type === Hls.ErrorTypes.MEDIA_ERROR) {
            if (mediaRecoveries < 2) {
              mediaRecoveries += 1;
              if (mediaRecoveries > 1) hls.swapAudioCodec();
              hls.recoverMediaError();
              return;
            }
          }
          if (!manifestFailed && data.type === Hls.ErrorTypes.NETWORK_ERROR) {
            if (networkRecoveries < 2) {
              networkRecoveries += 1;
              hls.startLoad();
              return;
            }
          }

          // The dead instance stops pulling in the background before the
          // chain moves on; the next link gets a fresh one.
          failedOver = true;
          destroy?.();
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

    // In fullscreen the transport bar floats over the picture and rests:
    // three seconds of still pointer while the picture runs, and it fades
    // out with the cursor; a move or a tap brings it back at once, and a
    // pause keeps it on screen. Leaving fullscreen wakes it for good.
    useEffect(() => {
      if (!fullscreen) {
        setControlsAsleep(false);
        return;
      }
      let timer = 0;
      const wake = () => {
        setControlsAsleep(false);
        if (timer) {
          window.clearTimeout(timer);
          timer = 0;
        }
        if (!playing) return;
        timer = window.setTimeout(() => setControlsAsleep(true), 3000);
      };
      wake();
      document.addEventListener("pointermove", wake);
      document.addEventListener("pointerdown", wake);
      document.addEventListener("keydown", wake);
      return () => {
        if (timer) window.clearTimeout(timer);
        document.removeEventListener("pointermove", wake);
        document.removeEventListener("pointerdown", wake);
        document.removeEventListener("keydown", wake);
      };
    }, [fullscreen, playing]);

    // Fullscreen asks for the whole screen: a level anything pinned — to
    // the old box, to a temporary choice — goes back to automatic, so the
    // ladder picks quality by bandwidth alone. Nothing in this player
    // pins levels; this is the insurance that it stays that way.
    useEffect(() => {
      if (!fullscreen) return;
      const hls = hlsRef.current;
      if (hls && hls.currentLevel !== -1) hls.currentLevel = -1;
    }, [fullscreen]);

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

    /**
     * What is on the air right now.
     *
     * The bar heads itself with the programme's own marks — the age rating,
     * the genre, the accessibility flags — and those are resolved from the
     * programme's title. The guide is read on the server, so the browser
     * asks the same sheet the channel panel reads and keeps the title. Once
     * a minute, because that is the guide's own resolution: a show that ends
     * at 12:59 is named no longer than a second past 13:00.
     */
    const minuteTick = useMinuteTick();
    const [programme, setProgramme] = useState<{
      id: string;
      title: string | null;
    }>({ id: channelId, title: null });

    useEffect(() => {
      let live = true;

      fetch(`/api/channel/${encodeURIComponent(channelId)}`)
        .then((response) => {
          if (!response.ok) throw new Error("bad status");
          return response.json() as Promise<{
            now?: { title?: string | null } | null;
          }>;
        })
        .then((sheet) => {
          if (live) setProgramme({ id: channelId, title: sheet?.now?.title ?? null });
        })
        .catch(() => {
          // The sheet did not answer: what the player already knew stays,
          // rather than the bar losing its marks over a slow minute.
        });

      return () => {
        live = false;
      };
    }, [channelId, minuteTick]);

    const programmeTitle = programme.id === channelId ? programme.title : null;

    /**
     * The stall watchdog.
     *
     * A picture that stops on a slow line is nudged back to work: the
     * loader is asked to pull again and — when frames are already waiting
     * in the buffer but the pipeline sits on them — the playhead moves a
     * hair forward so the decoder takes them. The chain only moves to the
     * next feed when two nudges, five seconds apart, have all failed;
     * while the video is paused (the wall, the visitor) nothing counts
     * and nothing advances.
     */
    useEffect(() => {
      const video = videoRef.current;
      if (!video || embedded) return;

      const GRACE_MS = 5000;
      const NUDGES = 2;
      let timer = 0;
      let attempts = 0;
      // Set once the chain has been told to move on: a frozen picture
      // must not keep sending the same message every few seconds. A new
      // source re-runs this effect from scratch.
      let givenUp = false;

      const disarm = () => {
        if (timer) {
          window.clearTimeout(timer);
          timer = 0;
        }
      };

      const nudge = () => {
        // A loader that went quiet looks exactly like a stall: ask it to
        // pull again. On Safari's native HLS there is no instance and
        // the seek below is the whole nudge.
        hlsRef.current?.startLoad();
        const ranges = video.buffered;
        if (ranges.length > 0) {
          const end = ranges.end(ranges.length - 1);
          if (end - video.currentTime > 0.25) {
            try {
              video.currentTime += 0.1;
            } catch {
              /* the seek was refused; the next nudge tries again */
            }
          }
        }
        if (video.paused) void video.play().catch(() => undefined);
      };

      const tick = () => {
        timer = 0;
        // Paused by the wall or by the visitor: nothing is stalled, and
        // a pause must never send the chain forward.
        if (video.paused) return;
        attempts += 1;
        if (attempts > NUDGES) {
          givenUp = true;
          failRef.current("Fluxul se blochează. Se încearcă următorul.");
          return;
        }
        nudge();
        timer = window.setTimeout(tick, GRACE_MS);
      };

      const watch = () => {
        if (givenUp || timer || video.paused) return;
        timer = window.setTimeout(tick, GRACE_MS);
      };

      const heal = () => {
        disarm();
        attempts = 0;
      };

      video.addEventListener("waiting", watch);
      video.addEventListener("stalled", watch);
      video.addEventListener("playing", heal);
      video.addEventListener("canplay", heal);

      return () => {
        disarm();
        video.removeEventListener("waiting", watch);
        video.removeEventListener("stalled", watch);
        video.removeEventListener("playing", heal);
        video.removeEventListener("canplay", heal);
      };
    }, [embedded, sourceUrl]);

    useImperativeHandle(
      ref,
      () => ({
        play: () => {
          // Behind the wall the parent may ask for the picture; it does
          // not get one.
          if (gatedRef.current) return;
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
    const failed = status === "error" && !block;
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

    /**
     * Pin the picture to one rung of the ladder, or hand the choice back
     * to the connection with `-1`.
     *
     * The instance is the one that holds the ladder, so there is nothing
     * to do without it — and the answer is read back off it on the next
     * switch, which is where the badge learns it.
     */
    const selectLevel = useCallback((index: number) => {
      const hls = hlsRef.current;
      if (!hls) return;
      hls.currentLevel = index;
      setCurrentLevel(index);
    }, []);

    return (
      <div
        ref={shellRef}
        className={cn(
          // `fx-player` is what the fullscreen rules hang off; a pointer
          // that rests in fullscreen loses the cursor with the bar.
          "relative isolate flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-black fx-player",
          fullscreen && controlsAsleep && "cursor-none",
          className,
        )}
      >
        <div
          className="fx-player-frame relative w-full bg-black max-sm:min-h-[56.25vw] max-sm:flex-1 rounded-2xl"
          style={
            {
              "--player-aspect": stream
                ? `${stream.width} / ${stream.height}`
                : "16 / 9",
              "--player-native-width": stream ? `${stream.width}px` : "none",
            } as CSSProperties
          }
        >
          <video
            ref={videoRef}
            className={cn(
              // Cover, never contain: the picture fills the frame by
              // cropping, so it is never stretched and never letterboxed.
              // Fullscreen is the one exception, set in CSS — there the
              // frame is the screen itself and the surplus turns black.
              "absolute inset-0 size-full bg-black object-cover rounded-2xl",
              embedded && "hidden",
            )}
            playsInline
            muted={muted}
            onLoadedMetadata={readStreamSize}
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
              className="absolute inset-0 size-full border-0 bg-black rounded-2xl"
            />
          ) : null}

          {embedded ? (
            <p className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-center bg-gradient-to-b from-black/85 to-transparent px-4 py-3 text-center text-[13px] font-medium text-ink/90 rounded-t-2xl">
              Redarea este controlată din playerul încorporat.
            </p>
          ) : null}

          {/* The picture is left to the picture: the loading spinner and
              the failure states below are the only things drawn over the
              frame. The live chrome — the LIVE badge, the buffer bar and
              the quality chip — lives in the transport bar, where every
              player in the industry keeps it. */}

          {busy && !failed && !embedded && !blocked ? (
            <div className="pointer-events-none absolute inset-0 grid place-items-center bg-black/55 rounded-2xl">
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
            <div className="absolute inset-0 grid place-items-center bg-black/80 p-6 text-center rounded-2xl">
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
            <div className="pointer-events-none absolute inset-0 grid place-items-center rounded-2xl">
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

          {/* Ten minutes before the wall: the line says so, once a day, and
              the picture keeps running underneath it. */}
          {embedded ? null : (
            <MinutesWarning
              signedIn={account.signedIn}
              plan={account.plan}
              remainingMinutes={account.remainingMinutes}
              gated={gated}
            />
          )}

          {/* The plan's own answer: too many screens, or a device the house
              does not know yet. Under the wall, over the picture. */}
          <StreamNotice
            block={gated ? null : block}
            onConfirm={confirmDevice}
            onRetry={retry}
          />

          {/* The wall: the account decides whether the picture may play.
              It is the last thing over the frame, and it says nothing about
              where the picture comes from. */}
          <Paywall
            visible={gated}
            reason={account.reason}
            minutesWatchedToday={account.minutesWatchedToday}
            allowanceMinutes={account.allowanceMinutes}
          />
        </div>

        {bare || embedded ? null : (
          <PlayerControls
            playing={playing}
            muted={muted}
            volume={volume}
            busy={busy}
            fullscreen={fullscreen}
            asleep={fullscreen && controlsAsleep}
            canFullscreen={fullscreenMode !== "none"}
            canSwitch={hasNext}
            canPictureInPicture={canPictureInPicture}
            behindLive={behindLive}
            liveWindow={liveWindow}
            nowPlaying={
              <>
                <span className="min-w-0 truncate font-display text-[12.5px] font-semibold tracking-tight text-ink [text-shadow:0_1px_6px_rgb(0_0_0/0.9)]">
                  {channelName}
                </span>
                <ProgrammeBadges
                  channelId={channelId}
                  title={programmeTitle}
                  className="min-w-0"
                />
              </>
            }
            quality={
              <PlayerQualityBadge
                variants={qualityLevels}
                currentLevel={currentLevel}
                stream={stream}
                onLevelChange={selectLevel}
              />
            }
            onSeek={seek}
            onTogglePlay={togglePlay}
            onToggleMute={toggleMute}
            onVolumeChange={changeVolume}
            onToggleFullscreen={toggleFullscreen}
            onTogglePictureInPicture={togglePictureInPicture}
            onJumpToLive={jumpToLive}
            onRetry={player.retry}
            onNextSource={player.advance}
          />
        )}
      </div>
    );
  },
);
