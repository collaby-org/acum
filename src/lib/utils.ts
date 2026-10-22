import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge conditional class names, resolving Tailwind conflicts. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Romanian diacritics-insensitive fold, used by the search box. */
export function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[șş]/g, "s")
    .replace(/[țţ]/g, "t")
    .replace(/[ăâ]/g, "a")
    .replace(/[î]/g, "i")
    .toLowerCase()
    .trim();
}

/**
 * A viewer count, short enough for a chip: "847", "4,2K", "1,3M".
 *
 * The decimal comma is the Romanian one — a dot would read as a thousands
 * separator next to it.
 */
export function formatViewers(count: number): string {
  if (!Number.isFinite(count) || count <= 0) return "0";
  if (count < 1000) return String(Math.round(count));
  if (count < 1_000_000) {
    const thousands = count / 1000;
    return `${thousands < 10 ? thousands.toFixed(1).replace(".", ",") : Math.round(thousands)}K`;
  }
  const millions = count / 1_000_000;
  return `${millions < 10 ? millions.toFixed(1).replace(".", ",") : Math.round(millions)}M`;
}

/** Romanian plural helper: 1 canal / 2 canale / 25 canale. */
export function plural(count: number, one: string, few: string, many: string) {
  if (count === 1) return one;
  const mod100 = count % 100;
  if (mod100 >= 1 && mod100 <= 19) return many;
  const mod10 = count % 10;
  if (mod10 === 1) return few;
  if (mod10 >= 2 && mod10 <= 4) return few;
  return many;
}

/**
 * Move a value from an old storage key to the current one.
 *
 * The product was renamed, and a shelf the visitor had already pinned under
 * the old name should not disappear because of it. The old value is copied
 * over once and the old key is removed; if the new key already holds
 * something, the new value wins.
 */
export function migrateStorageKey(from: string, to: string): void {
  if (typeof window === "undefined") return;
  try {
    const legacy = window.localStorage.getItem(from);
    if (legacy === null) return;
    if (window.localStorage.getItem(to) === null) {
      window.localStorage.setItem(to, legacy);
    }
    window.localStorage.removeItem(from);
  } catch {
    /* private mode — there is nothing to migrate */
  }
}
