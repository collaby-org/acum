import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "@/lib/utils";

/**
 * The one primitive a television needs.
 *
 * Everything the D-pad can land on is this. It exists so the contract
 * between the navigation engine and the components lives in one place
 * instead of being spelled out in every card, every nav item and every
 * button: an element marked `data-tv-focus`, wearing the ring, scaled
 * under focus, always a real `<button>` or `<a>` so Enter and the screen
 * reader both keep working.
 *
 * `asChild` follows the same contract the app's `Button` does — pass the
 * element you want and keep every style. The difference is that this one
 * also carries the *focus* contract, which is the thing a remote actually
 * navigates.
 */

/** The class string every TV focusable wears, before its ring. */
export const TV_FOCUSABLE_CLASS = "tv-focusable";

/** The ring utilities, one per job. */
export const TV_RING = {
  /** A card: gold bar, gap, bloom, and the full elevation ladder. */
  full: "tv-focus-ring",
  /** A control that already carries a light of its own, and needs the
      ring to replace that light rather than fight it. */
  soft: "tv-focus-ring-soft",
  /** Something that draws its own focus state, or none at all. */
  none: "",
} as const;

export type TVFocusableProps = React.ComponentProps<"button"> & {
  /** Render the child element instead of a <button>, keeping the styles. */
  asChild?: boolean;
  /** The focus ring. Defaults to the full one — the card's. */
  ring?: keyof typeof TV_RING;
};

export function TVFocusable({
  className,
  asChild = false,
  ring = "full",
  ...props
}: TVFocusableProps) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      type={asChild ? undefined : "button"}
      data-tv-focus=""
      className={cn(TV_FOCUSABLE_CLASS, TV_RING[ring], className)}
      {...props}
    />
  );
}

/* ------------------------------------------------------------------ *
 * The row contract
 * ------------------------------------------------------------------ */

/**
 * The class string a rail wears.
 *
 * A rail is a navigation scope that wraps: left and right meet at the
 * far end of the row, so a strip of six channels is a ring rather than a
 * corridor. The rail also marks out where the CSS dimming applies — the
 * sibling cards fall back into the dark when one of them is focused.
 */
export const TV_RAIL_CLASS = "tv-rail";

/** The data attributes a rail carries. Read by the engine and the CSS. */
export const TV_RAIL_PROPS = {
  "data-tv-rail": "",
  "data-tv-nav": "",
  "data-tv-loop": "x",
} as const;
