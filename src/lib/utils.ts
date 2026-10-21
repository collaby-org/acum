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
