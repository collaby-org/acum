/**
 * The account, as the browser knows it.
 *
 * The hook answers four questions, right now: is somebody signed in, what
 * plan are they on, how much of today's allowance is gone, and is the
 * picture behind a wall.
 *
 * The answers come from the server. The browser never counts the minutes
 * itself and never decides that the limit is reached — it asks
 * `/api/account` and does what it is told. That is what keeps the free
 * tier honest: clearing the storage, opening another tab or patching the
 * hook in the console changes nothing, because the clock is a row in the
 * database.
 *
 * The state lives in one store for the whole page, the way the favourites
 * do: the header, the pricing page and the player all read the same
 * account, and there is one session listener and one poll behind them.
 */
"use client";

import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";
import { FREE_ALLOWANCE_SECONDS, type Plan } from "@/lib/supabase/plans";

/** The state the interface works with. Mirrors the server's answer. */
export type AccountState = {
  signedIn: boolean;
  email: string | null;
  plan: Plan;
  planUntil: string | null;
  bypass: boolean;
  minutesWatchedToday: number;
  allowanceMinutes: number | null;
  remainingMinutes: number | null;
  gated: boolean;
  reason: "signed_out" | "allowance_spent" | null;
  householdId: string | null;
  ready: boolean;
};

/** The state before the server has answered. */
const UNKNOWN: AccountState = {
  signedIn: false,
  email: null,
  plan: "free",
  planUntil: null,
  bypass: false,
  minutesWatchedToday: 0,
  allowanceMinutes: FREE_ALLOWANCE_SECONDS / 60,
  remainingMinutes: FREE_ALLOWANCE_SECONDS / 60,
  gated: false,
  reason: null,
  householdId: null,
  ready: false,
};

/** The state of a visitor who is not signed in. */
const SIGNED_OUT: AccountState = {
  ...UNKNOWN,
  ready: true,
  gated: true,
  reason: "signed_out",
};

/** How often the state is read again, while somebody is signed in. */
const POLL_MS = 60_000;

/** How often the state is read while a purchase is settling. */
const PURCHASE_POLL_MS = 5_000;

/** How long the purchase is watched for. */
const PURCHASE_POLL_WINDOW_MS = 120_000;

/**
 * A message a person can read.
 *
 * The provider answers in English; the interface is in Romanian.
 */
export function accountError(code?: string, message?: string): string {
  const text = (message ?? "").toLowerCase();

  if (code === "invalid_credentials" || text.includes("invalid login")) {
    return "Emailul sau parola nu sunt corecte.";
  }
  if (code === "email_exists" || text.includes("already registered")) {
    return "Există deja un cont cu acest email.";
  }
  if (code === "weak_password" || text.includes("at least")) {
    return "Parola trebuie să aibă cel puțin 6 caractere.";
  }
  if (code === "email_not_confirmed" || text.includes("not confirmed")) {
    return "Confirmă adresa de email înainte de a te autentifica.";
  }
  if (text.includes("rate limit") || text.includes("too many")) {
    return "Prea multe încercări. Încearcă din nou în câteva minute.";
  }
  if (text.includes("fetch") || text.includes("network")) {
    return "Nu am putut contacta serverul. Verifică conexiunea.";
  }

  return message && message.length > 0
    ? message
    : "Ceva nu a mers. Încearcă din nou.";
}

/** The session token of the current session, when there is one. */
async function currentToken(): Promise<string | null> {
  try {
    const { data } = await getSupabaseClient().auth.getSession();
    return data.session?.access_token ?? null;
  } catch {
    return null;
  }
}

/**
 * The session token, for the requests the browser makes itself.
 *
 * The token is the only thing the browser holds; what it may do with it is
 * decided on the server.
 */
export async function accountToken(): Promise<string | null> {
  return currentToken();
}

/**
 * Re-read the account state.
 *
 * The player calls it when the server refuses a stream: the browser's copy
 * of the state may be out of date, and the wall has to know why it is up.
 */
export async function refreshAccount(): Promise<void> {
  await refresh();
}

/**
 * True when the page was opened after a purchase.
 *
 * The payment provider sends the visitor back with a marker in the address;
 * the plan may not be on the account yet — the webhook is a moment behind —
 * so the state is polled for a while.
 */
function purchasePending(): boolean {
  if (typeof window === "undefined") return false;
  const search = new URLSearchParams(window.location.search);
  return search.get("achizitie") === "ok" || search.has("session_id");
}

/* ------------------------------------------------------------------ *
 * The store
 * ------------------------------------------------------------------ */

const listeners = new Set<() => void>();
let current: AccountState = UNKNOWN;
let started = false;
let pollTimer: number | null = null;
let purchaseTimer: number | null = null;

function emit(): void {
  for (const listener of listeners) listener();
}

function setState(next: AccountState): void {
  current = next;
  emit();
}

/**
 * Read the state from the server.
 *
 * Without a session the answer is the anonymous one, and the server says
 * so itself — the browser does not guess.
 */
async function refresh(): Promise<void> {
  const token = await currentToken();
  syncSessionCookie(token);

  if (!token) {
    if (!current.signedIn && current.ready) return;
    setState(SIGNED_OUT);
    return;
  }

  try {
    const response = await fetch("/api/account", {
      headers: { authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!response.ok) return;
    const answer = (await response.json()) as AccountState;
    setState({ ...UNKNOWN, ...answer, ready: true });
  } catch {
    /* the state stays as it is; the next poll will try again */
  }
}

/** The timers that keep the state fresh. */
function schedulePolls(): void {
  if (pollTimer !== null) window.clearInterval(pollTimer);
  pollTimer = window.setInterval(() => {
    if (!current.signedIn) return;
    void refresh();
  }, POLL_MS);

  if (purchaseTimer !== null) window.clearInterval(purchaseTimer);
  purchaseTimer = null;
}

/** The fast poll that waits for a purchase to land. */
function watchPurchase(): void {
  if (purchaseTimer !== null) return;
  if (!purchasePending()) return;

  const started = Date.now();
  purchaseTimer = window.setInterval(() => {
    void refresh();
    if (Date.now() - started > PURCHASE_POLL_WINDOW_MS) {
      if (purchaseTimer !== null) window.clearInterval(purchaseTimer);
      purchaseTimer = null;
    }
  }, PURCHASE_POLL_MS);
}

/** Start the store: the session listener, the first read, the polls. */
function start(): void {
  if (started) return;
  started = true;

  const client = getSupabaseClient();

  client.auth.onAuthStateChange(() => {
    // The callback runs while the provider holds a lock, so the read is put
    // on the next tick rather than made right here.
    window.setTimeout(() => {
      void refresh();
    }, 0);
  });

  void client.auth.getSession().then(() => {
    void refresh();
  });

  schedulePolls();

  // The tab comes back to the front: the state may have moved on.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void refresh();
  });
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  start();
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): AccountState {
  return current;
}

function getServerSnapshot(): AccountState {
  return UNKNOWN;
}

/* ------------------------------------------------------------------ *
 * The session cookie
 *
 * The desk gate runs on the server, and a server cannot read localStorage —
 * which is where the session lives. So the access token is mirrored into a
 * cookie the moment it is read. It is the same token, with the same lifetime
 * and the same exposure, and it is what lets `/admin` answer with a real
 * refusal instead of pretending the visitor is signed out.
 *
 * The cookie holds a base64url JSON payload (`{ access_token }`), the shape
 * the desk's own reader already understands.
 * ------------------------------------------------------------------ */

const SESSION_COOKIE = "acum-session";

/** One hour: every account refresh rewrites it, so it never goes stale. */
const SESSION_COOKIE_MAX_AGE = 60 * 60;

/** Base64url, without the padding a cookie does not need. */
function encodeSession(token: string): string {
  const bytes = new TextEncoder().encode(JSON.stringify({ access_token: token }));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Mirror the session into the cookie, or clear it. */
function syncSessionCookie(token: string | null): void {
  if (typeof document === "undefined") return;
  if (!token) {
    document.cookie = `${SESSION_COOKIE}=; path=/; max-age=0; samesite=lax`;
    return;
  }
  document.cookie = `${SESSION_COOKIE}=${encodeSession(token)}; path=/; max-age=${SESSION_COOKIE_MAX_AGE}; samesite=lax`;
}

/* ------------------------------------------------------------------ *
 * The actions
 * ------------------------------------------------------------------ */

async function signIn(email: string, password: string): Promise<void> {
  const { error } = await getSupabaseClient().auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw new Error(accountError(error.code, error.message));
  await refresh();
  watchPurchase();
}

async function signUp(email: string, password: string): Promise<void> {
  const { data, error } = await getSupabaseClient().auth.signUp({
    email,
    password,
    options: {
      data: { display_name: email.split("@")[0] ?? "" },
      emailRedirectTo:
        typeof window !== "undefined" ? window.location.origin : undefined,
    },
  });
  if (error) throw new Error(accountError(error.code, error.message));

  // A project with the confirmation switched on answers with no session;
  // the visitor has to confirm the address first.
  if (!data.session) {
    throw new Error(
      "Contul a fost creat. Confirmă adresa de email, apoi autentifică-te.",
    );
  }
  await refresh();
  watchPurchase();
}

async function signOut(): Promise<void> {
  await getSupabaseClient().auth.signOut();
  syncSessionCookie(null);
  setState(SIGNED_OUT);
}

/**
 * Sign in through Google.
 *
 * The provider answers with a redirect: the browser leaves for Google
 * and comes back at the callback route with the answer in the address.
 * Nothing is refreshed here — the call does not return before the page
 * has gone.
 */
async function signInWithGoogle(): Promise<void> {
  const { error } = await getSupabaseClient().auth.signInWithOAuth({
    provider: "google",
    options: {
      // The callback turns the redirect into a session and continues to
      // the accounts page with a clean address.
      redirectTo: `${window.location.origin}/auth/callback`,
    },
  });
  if (error) throw new Error(accountError(error.code, error.message));
}

async function resetPasswordForEmail(email: string): Promise<void> {
  const { error } = await getSupabaseClient().auth.resetPasswordForEmail(
    email.trim(),
    {
      redirectTo:
        typeof window !== "undefined"
          ? `${window.location.origin}/auth/callback`
          : undefined,
    },
  );
  if (error) throw new Error(accountError(error.code, error.message));
}

/**
 * Report a watch session and take the new state.
 *
 * The server writes down what it is willing to write down and answers with
 * the state it now holds; the paywall follows the answer.
 */
async function report(
  channel: string,
  seconds: number,
): Promise<AccountState | null> {
  const token = await currentToken();
  if (!token) return null;

  try {
    const response = await fetch("/api/account", {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ channel, seconds }),
      cache: "no-store",
      // The last report of a session is sent while the tab is closing;
      // `keepalive` lets it out before the page goes.
      keepalive: true,
    });
    if (!response.ok) return null;
    const answer = (await response.json()) as AccountState;
    setState({ ...UNKNOWN, ...answer, ready: true });
    return answer;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ *
 * The hook
 * ------------------------------------------------------------------ */

export function useAccount() {
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  // The purchase poll is started by the store; this keeps it alive while
  // the page is on screen.
  useEffect(() => {
    if (state.signedIn) watchPurchase();
  }, [state.signedIn]);

  return useMemo(
    () => ({
      state,
      ready: state.ready,
      signedIn: state.signedIn,
      email: state.email,
      plan: state.plan,
      planUntil: state.planUntil,
      bypass: state.bypass,
      minutesWatchedToday: state.minutesWatchedToday,
      allowanceMinutes: state.allowanceMinutes,
      remainingMinutes: state.remainingMinutes,
      /** True when the picture must not play. */
      gated: state.ready && state.gated,
      /** Why the picture is gated. */
      reason: state.reason,
      householdId: state.householdId,
      signIn,
      signUp,
      signInWithGoogle,
      signOut,
      resetPasswordForEmail,
      refresh,
      report,
    }),
    [state],
  );
}

/**
 * The watch clock.
 *
 * The player knows how long it has been playing; the server counts it. The
 * clock is reported every few minutes and once more when the picture goes
 * away, so nothing is lost when the visitor closes the tab.
 */
export function useWatchClock({
  channelId,
  playing,
  signedIn,
  onReport,
}: {
  channelId: string;
  playing: boolean;
  signedIn: boolean;
  onReport: (seconds: number) => void;
}) {
  const pendingRef = useRef(0);
  const lastRef = useRef<number | null>(null);
  const onReportRef = useRef(onReport);

  useEffect(() => {
    onReportRef.current = onReport;
  }, [onReport]);

  // The clock only runs while the picture is on screen.
  useEffect(() => {
    if (playing) {
      lastRef.current = Date.now();
      return;
    }
    lastRef.current = null;
  }, [playing]);

  const flush = useCallback(() => {
    const seconds = pendingRef.current;
    pendingRef.current = 0;
    if (seconds <= 0) return;
    onReportRef.current(seconds);
  }, []);

  // Every second, the second that passed while the picture played.
  useEffect(() => {
    if (!playing || !signedIn) return;

    const timer = window.setInterval(() => {
      const last = lastRef.current;
      if (last === null) return;
      const passed = Math.floor((Date.now() - last) / 1000);
      if (passed <= 0) return;
      lastRef.current = Date.now();
      pendingRef.current += passed;
    }, 1000);

    return () => window.clearInterval(timer);
  }, [playing, signedIn]);

  // A report every few minutes, so a long session is counted as it goes.
  useEffect(() => {
    if (!signedIn) return;
    const timer = window.setInterval(flush, 120_000);
    return () => window.clearInterval(timer);
  }, [flush, signedIn]);

  // The last one, when the picture goes away.
  useEffect(() => {
    return () => {
      const seconds = pendingRef.current;
      pendingRef.current = 0;
      if (seconds > 0) onReportRef.current(seconds);
    };
  }, []);

  return { flush, channelId };
}
