import Link from "next/link";
import { CATEGORIES } from "@/data/channels";
import type { CategoryId } from "@/data/types";
import { cn } from "@/lib/utils";

/**
 * The categories, and the addresses they answer to.
 *
 * The catalogue has seven categories. The navigation of the site speaks in
 * Romanian, so every category answers to more than one slug — a visitor who
 * types „/canale/filme” must land on the same page as one who types
 * „/canale/movies”.
 */

/** The catalogue id behind every slug the site answers to. */
const ALIASES: Record<string, CategoryId> = {
  generaliste: "generaliste",
  generale: "generaliste",
  general: "generaliste",
  stiri: "stiri",
  "stiri-actualitate": "stiri",
  sport: "sport",
  sporturi: "sport",
  movies: "movies",
  filme: "movies",
  "filme-si-seriale": "movies",
  divertisment: "movies",
  kids: "kids",
  copii: "kids",
  documentare: "documentare",
  doc: "documentare",
  music: "music",
  muzica: "music",
};

/** The categories, in the order the site presents them. */
export const CATEGORY_PAGES = CATEGORIES.map((category) => ({
  id: category.id,
  label: category.label,
  tagline: category.tagline,
}));

/**
 * The category a slug names.
 *
 * Returns the catalogue id and whether the slug was an alias, so the page
 * can say what it is showing without pretending the alias is a category of
 * its own.
 */
export function resolveCategory(
  slug: string,
): { id: CategoryId; alias: string } | null {
  const key = decodeURIComponent(slug ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "-");
  const id = ALIASES[key];
  if (!id) return null;
  return { id, alias: key };
}

/** The slugs the site publishes for a category, the catalogue id first. */
export function categorySlugs(id: CategoryId): string[] {
  return Object.entries(ALIASES)
    .filter(([, value]) => value === id)
    .map(([key]) => key);
}

/**
 * The category navigation: the same language as the footer's first column,
 * so a visitor can move between categories from anywhere.
 *
 * "Toate" is the grouped list of every channel, so it points at the grouped
 * page — which is also where the visitor is when no category is selected.
 */
export function CategoryNav({
  current,
  className,
}: {
  current?: CategoryId | null;
  className?: string;
}) {
  return (
    <nav aria-label="Categorii de canale" className={cn("mask-edges", className)}>
      <ul className="flex gap-2 overflow-x-auto pb-1 fx-hide-scrollbar">
        <li className="shrink-0">
          <Link
            href="/canale/grupate"
            className={cn(
              "inline-flex h-9 items-center rounded-full border px-4 text-[13px] transition-[background-color,border-color,color] duration-300",
              current
                ? "border-white/[0.08] bg-white/[0.03] text-ink-muted hover:border-white/16 hover:text-ink"
                : "border-signal/40 bg-signal/[0.10] text-ink",
            )}
          >
            Toate
          </Link>
        </li>
        {CATEGORY_PAGES.map((category) => (
          <li key={category.id} className="shrink-0">
            <Link
              href={`/canale/${category.id}`}
              className={cn(
                "inline-flex h-9 items-center rounded-full border px-4 text-[13px] transition-[background-color,border-color,color] duration-300",
                current === category.id
                  ? "border-signal/40 bg-signal/[0.10] text-ink"
                  : "border-white/[0.08] bg-white/[0.03] text-ink-muted hover:border-white/16 hover:text-ink",
              )}
            >
              {category.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
