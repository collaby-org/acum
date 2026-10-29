import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * The safe area, as a component.
 *
 * A television is not a rectangle of pixels. It is a panel that crops
 * what it is given: the notch of a phone, the home indicator, the two
 * percent a real set overscans, the letterbox of a 4:3 feed on a 16:9
 * screen. Anything that sits in the outer few percent of the frame is
 * not on the screen at all.
 *
 * So a television layout is inset by default, not padded by exception.
 * `viewport-fit=cover` is what makes `env(safe-area-inset-*)` real — the
 * root layout already declares it — and the utilities this component
 * applies read those insets and take whichever is larger, the gutter or
 * the inset.
 *
 * It is a `div` with a class rather than anything clever, because the one
 * thing this component must never do is add layout of its own: it is
 * applied to a number of different sections and a display or a grid
 * property here would win over the one the caller chose.
 */

export type TVSafeAreaProps = {
  /** The content. */
  children?: React.ReactNode;
  /** Also inset the block edges. For full-bleed banners. */
  block?: boolean;
  className?: string;
};

export function TVSafeArea({ children, block = false, className }: TVSafeAreaProps) {
  return (
    <div
      data-tv-safe-area=""
      className={cn("tv-safe-area", block && "tv-safe-area-block", className)}
    >
      {children}
    </div>
  );
}
