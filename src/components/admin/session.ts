/**
 * How the desk talks to its own API.
 *
 * The session is the Supabase session, the same one the visitor carries.
 * It travels in the `Authorization` header, exactly the way `/api/account`
 * receives it, and the server decides what it may do with it — the browser
 * is never asked whether it is allowed in.
 */
"use client";

import { useCallback, useEffect, useState } from "react";
import { accountToken } from "@/hooks/use-account";

/** What the API answered. */
export type DeskStatus =
  | "loading"
  | "ok"
  | "signed-out"
  | "forbidden"
  | "no-key"
  | "error";

/** A request to the desk's own API, with the session on it. */
export async function deskFetch(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const token = await accountToken();
  const headers = new Headers(init?.headers);
  if (token) headers.set("authorization", `Bearer ${token}`);
  if (init?.body && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  return fetch(path, { ...init, headers, cache: "no-store" });
}

/** The state a status code means. */
export function statusOf(response: Response): DeskStatus {
  if (response.ok) return "ok";
  if (response.status === 401) return "signed-out";
  if (response.status === 403) return "forbidden";
  if (response.status === 503) return "no-key";
  return "error";
}

/** The message the API sent with a refusal. */
export async function errorOf(response: Response): Promise<string | null> {
  try {
    const body = (await response.json()) as { error?: string };
    return body?.error ?? null;
  } catch {
    return null;
  }
}

/**
 * One of the desk's own resources, read and kept fresh.
 *
 * The panel asks the API and obeys the answer: the guard is on the server,
 * so the refusal the API sends is the truth the interface shows.
 */
export function useDeskResource<T>(path: string, intervalMs = 0) {
  const [data, setData] = useState<T | null>(null);
  const [status, setStatus] = useState<DeskStatus>("loading");
  const [message, setMessage] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  const load = useCallback(async () => {
    try {
      const response = await deskFetch(path);
      const state = statusOf(response);
      if (state === "ok") {
        setData((await response.json()) as T);
        setStatus("ok");
        setMessage(null);
        return;
      }
      setStatus(state);
      setMessage(await errorOf(response));
    } catch {
      setStatus("error");
      setMessage("Nu am putut contacta serverul.");
    }
  }, [path]);

  useEffect(() => {
    // The read starts in a microtask: the state changes when the answer
    // arrives, not while the effect is running.
    void Promise.resolve().then(() => load());
  }, [load, nonce]);

  useEffect(() => {
    if (!intervalMs) return;
    const timer = window.setInterval(() => void load(), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs, load]);

  return {
    data,
    status,
    message,
    reload: useCallback(() => setNonce((value) => value + 1), []),
  };
}
