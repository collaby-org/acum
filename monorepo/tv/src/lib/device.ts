/**
 * This browser's device.
 *
 * The audience count uses a value that lives for the tab; the household
 * check needs something that lives longer, because it has to say "the same
 * television, tonight and next week". So this is a random identifier written
 * once into `localStorage` and never sent anywhere but our own server.
 *
 * It names a browser, not a person: it carries no fingerprint, no hardware
 * detail and no address. Clearing the site data gives the browser a new one,
 * which is exactly what a household confirmation is for.
 */
"use client";

const KEY = "acum.device";

/** True when the value looks like one we wrote. */
function valid(value: string | null): value is string {
  return Boolean(value && /^[A-Za-z0-9._-]{8,128}$/.test(value));
}

/** A new identifier, in whatever shape the browser can make one. */
function create(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `d-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

/**
 * The device identifier, created on first use.
 *
 * When storage is refused — private mode, a locked-down browser — the value
 * lives for the page. A household confirmation then costs one extra step per
 * visit, which is the honest price of not being able to remember.
 */
export function deviceId(): string {
  if (typeof window === "undefined") return "";
  try {
    const stored = window.localStorage.getItem(KEY);
    if (valid(stored)) return stored;
    const next = create();
    window.localStorage.setItem(KEY, next);
    return next;
  } catch {
    return `volatile-${create()}`;
  }
}
