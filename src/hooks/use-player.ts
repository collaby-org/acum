"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { accountToken, refreshAccount } from "@/hooks/use-account";
import { deviceId } from "@/lib/device";

/**
 * This browser's name.
 *
 * It is a random value, kept for as long as the tab is open, and it
 * identifies a browser rather than a person — which is all the audience
 * count needs. It travels with every segment request, so the server can
 * count the distinct browsers watching each channel instead of counting
 * requests, which would be the number of segments rather than the number
 * of people.
 */
let viewer: string | null = null;

function viewerId(): string {
  if (viewer) return viewer;
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    viewer = crypto.randomUUID();
  } else {
    viewer = `v-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
  }
  return viewer;
}

/** The playback state machine. */
export type PlayerStatus =
  /** Nothing has been started yet. */
  | "idle"
  /** Asking the server for the playlist chain. */
  | "resolving"
  /** Frames are on screen. */
  | "playing"
  /** The current link died, the next one is being tried. */
  | "retrying"
  /** Nothing left to try. */
  | "error";

/** One playable link, already resolved and pointed at our proxy. */
export type PlayerSource = {
  id: string;
  label: string;
  /** `hls` is a playlist we proxy; `embed` is a sanitised upstream frame. */
  kind: "hls" | "embed";
  url: string;
  playable: boolean;
};

/**
 * Why the server would not open a stream, when the reason is the plan.
 *
 * The wall (`allowance_spent`) is a different thing: it belongs to the day,
 * and the panel that answers it is the paywall. These are about the screens
 * a plan carries, and the player answers them itself.
 */
export type StreamBlock = {
  reason: "stream_limit" | "verify_device";
  /** What to tell the viewer, in the server's own words. */
  message: string;
  /** How many streams the plan carries, for `stream_limit`. */
  limit?: number;
};

export type UsePlayerOptions = {
  /**
   * The channel to play. The browser names the channel; the server looks the
   * upstream feeds up and hands back a chain of our own URLs.
   */
  channelId: string;
  /** Resolve the chain as soon as the hook mounts. */
  autoStart?: boolean;
  /** Called on every transition of the state machine. */
  onStatusChange?: (status: PlayerStatus) => void;
};

export type UsePlayerResult = {
  status: PlayerStatus;
  /** Index of the link being tried right now. */
  sourceIndex: number;
  /** How many links have been tried so far. */
  attempts: number;
  /** The resolved chain, ordered best first. */
  sources: PlayerSource[];
  /** The link the player should be loading right now. */
  source: PlayerSource | null;
  error: string | null;
  /** Set when the plan — not the allowance — is what stopped the picture. */
  block: StreamBlock | null;
  /** Resolve the chain if it is not resolved yet, then play. */
  play: () => void;
  /** Move to the next link in the chain. */
  advance: () => void;
  /** Start over from the first link of the chain. */
  retry: () => void;
  /**
   * Confirm this device as the household's screen, then play again.
   *
   * This is the "update household" action: it is deliberate, it belongs to
   * the account, and it closes the streams left open on the old device.
   */
  confirmDevice: () => Promise<void>;
  /** Called by the video element once frames are on screen. */
  markPlaying: () => void;
  /** Called by the video element when the current link died. */
  markFailed: (message: string) => void;
};

const FAILED_MESSAGE = "Fluxul nu este disponibil.";
const EMPTY_SOURCES: PlayerSource[] = [];

type ChainState = {
  /** The feeds the chain was resolved for. */
  signature: string;
  sources: PlayerSource[];
  sourceIndex: number;
  attempts: number;
  error: string | null;
  status: PlayerStatus;
  /** The registered stream behind the chain, when the server opened one. */
  session: string | null;
  /** The plan's answer, when it is what stopped the chain. */
  block: StreamBlock | null;
};

/**
 * The playback state machine.
 *
 * The chain is resolved once, server-side, and walked from front to back:
 * every link is either a mirror of the same feed or the next feed of the
 * channel. A link that dies moves the machine to `retrying` and the next one
 * is loaded, so a single dead mirror never ends the session.
 */
export function usePlayer({
  channelId,
  autoStart = false,
  onStatusChange,
}: UsePlayerOptions): UsePlayerResult {
  const signature = channelId;

  const [state, setState] = useState<ChainState>({
    signature,
    sources: EMPTY_SOURCES,
    sourceIndex: 0,
    attempts: 0,
    error: null,
    status: "idle",
    session: null,
    block: null,
  });

  const requestRef = useRef<AbortController | null>(null);
  const onStatusChangeRef = useRef(onStatusChange);

  useEffect(() => {
    onStatusChangeRef.current = onStatusChange;
  }, [onStatusChange]);

  const announce = useCallback((next: PlayerStatus) => {
    onStatusChangeRef.current?.(next);
  }, []);

  // A chain resolved for other feeds is not this channel's chain.
  const fresh = state.signature === signature;
  const sources = fresh ? state.sources : EMPTY_SOURCES;
  const sourceIndex = fresh ? state.sourceIndex : 0;
  const attempts = fresh ? state.attempts : 0;
  const error = fresh ? state.error : null;
  const status = fresh ? state.status : "idle";
  const block = fresh ? state.block : null;
  const session = fresh ? state.session : null;

  const resolve = useCallback(async () => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;

    setState((current) => ({
      ...current,
      signature,
      status: "resolving",
      error: null,
      block: null,
      session: null,
    }));
    announce("resolving");

    try {
      const token = await accountToken();
      const response = await fetch("/api/player", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          // The gate reads the account from this header. It is the same
          // token the account routes use.
          ...(token ? { authorization: `Bearer ${token}` } : {}),
          // The plan counts screens, and a screen is a browser that keeps a
          // name. The server falls back to its own fingerprint without one.
          "x-acum-device": deviceId(),
        },
        body: JSON.stringify({ channel: channelId, viewer: viewerId() }),
        signal: controller.signal,
      });

      if (!response.ok) {
        /**
         * A refusal with a reason.
         *
         * The wall is one of them: the allowance is spent, and the account
         * is re-read so the panel knows why it is up. The plan's own limits
         * are the others — too many screens, or a device the house does not
         * recognise — and those are the player's to explain.
         */
        let refusal: {
          reason?: unknown;
          error?: unknown;
          limit?: unknown;
        } = {};
        try {
          refusal = (await response.json()) as typeof refusal;
        } catch {
          refusal = {};
        }

        if (
          refusal.reason === "stream_limit" ||
          refusal.reason === "verify_device"
        ) {
          setState((current) => ({
            ...current,
            signature,
            status: "error",
            error: null,
            sources: EMPTY_SOURCES,
            session: null,
            block: {
              reason: refusal.reason as StreamBlock["reason"],
              message:
                typeof refusal.error === "string"
                  ? refusal.error
                  : FAILED_MESSAGE,
              limit:
                typeof refusal.limit === "number" ? refusal.limit : undefined,
            },
          }));
          announce("error");
          return;
        }

        if (response.status === 403) {
          void refreshAccount();
        }
        setState((current) => ({
          ...current,
          signature,
          status: "error",
          error: FAILED_MESSAGE,
        }));
        announce("error");
        return;
      }

      const payload = (await response.json()) as {
        sources?: PlayerSource[];
        session?: unknown;
      };
      const chain = Array.isArray(payload.sources) ? payload.sources : [];
      if (controller.signal.aborted) return;

      setState((current) => ({
        ...current,
        signature,
        sources: chain,
        sourceIndex: 0,
        attempts: 0,
        status: chain.length === 0 ? "error" : "resolving",
        error: chain.length === 0 ? FAILED_MESSAGE : null,
        block: null,
        session:
          typeof payload.session === "string" ? payload.session : null,
      }));

      if (chain.length === 0) announce("error");
    } catch (cause) {
      if (controller.signal.aborted) return;
      setState((current) => ({
        ...current,
        signature,
        status: "error",
        error:
          cause instanceof Error && cause.name === "AbortError"
            ? FAILED_MESSAGE
            : "Nu am putut contacta serverul.",
      }));
      announce("error");
    }
  }, [announce, channelId, signature]);
  const advance = useCallback(() => {
    const chain = fresh ? sources : EMPTY_SOURCES;
    const index = fresh ? sourceIndex : 0;
    const next = index + 1;

    if (next >= chain.length) {
      setState((current) => ({
        ...current,
        signature,
        status: "error",
        error: FAILED_MESSAGE,
      }));
      announce("error");
      return;
    }

    setState((current) => ({
      ...current,
      signature,
      status: "retrying",
      sourceIndex: next,
      attempts: current.attempts + 1,
      error: null,
    }));
    announce("retrying");
  }, [announce, fresh, signature, sourceIndex, sources]);

  const play = useCallback(() => {
    if (sources.length === 0) {
      void resolve();
      return;
    }
    if (status === "error" || status === "retrying") {
      setState((current) => ({ ...current, signature, status: "resolving" }));
      announce("resolving");
    }
  }, [announce, resolve, signature, sources.length, status]);

  const retry = useCallback(() => {
    setState((current) => ({
      ...current,
      signature,
      sources: EMPTY_SOURCES,
      sourceIndex: 0,
      attempts: 0,
      error: null,
      block: null,
      session: null,
    }));
    void resolve();
  }, [resolve, signature]);

  /**
   * Confirm this screen as the house's own.
   *
   * The server binds the device and closes the streams the account left open
   * elsewhere. Then the chain is resolved again, because the refusal it got
   * a moment ago is no longer true.
   */
  const confirmDevice = useCallback(async () => {
    try {
      const token = await accountToken();
      if (!token) return;
      const response = await fetch("/api/account/device", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ device: deviceId() }),
      });
      if (!response.ok) return;
      setState((current) => ({
        ...current,
        signature,
        block: null,
        error: null,
      }));
      void resolve();
    } catch {
      /* the refusal stays on screen; the viewer can try again */
    }
  }, [resolve, signature]);

  const markPlaying = useCallback(() => {
    setState((current) =>
      current.status === "playing"
        ? current
        : { ...current, signature, status: "playing" },
    );
    announce("playing");
  }, [announce, signature]);

  const markFailed = useCallback(
    (message: string) => {
      const chain = fresh ? sources : EMPTY_SOURCES;
      const index = fresh ? sourceIndex : 0;
      if (index + 1 < chain.length) {
        advance();
        return;
      }
      setState((current) => ({
        ...current,
        signature,
        status: "error",
        error: message || FAILED_MESSAGE,
      }));
      announce("error");
    },
    [advance, announce, fresh, signature, sourceIndex, sources],
  );

  useEffect(() => {
    if (!autoStart) return;
    void resolve();
  }, [autoStart, resolve]);

  /**
   * The heartbeat.
   *
   * A seat is a row with a fresh `last_seen_at`; the server frees it after
   * ninety seconds of silence. Beating every thirty keeps an open screen
   * counted, and the cleanup closes the row the moment it goes away — the
   * difference between a closed tab and a seat held all evening.
   */
  useEffect(() => {
    if (!session) return;

    const beat = async (method: "POST" | "DELETE") => {
      try {
        const token = await accountToken();
        if (!token) return;
        await fetch("/api/player/heartbeat", {
          method,
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ session }),
        });
      } catch {
        /* a heartbeat that fails is not a picture that fails */
      }
    };

    void beat("POST");
    const timer = window.setInterval(() => void beat("POST"), 30_000);

    return () => {
      window.clearInterval(timer);
      void beat("DELETE");
    };
  }, [session]);

  useEffect(() => () => requestRef.current?.abort(), []);

  const source = sources[sourceIndex] ?? null;

  return {
    status,
    sourceIndex,
    attempts,
    sources,
    source,
    error,
    block,
    play,
    advance,
    retry,
    confirmDevice,
    markPlaying,
    markFailed,
  };
}
