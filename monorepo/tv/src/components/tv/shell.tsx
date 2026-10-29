"use client";

import * as React from "react";
import { useRemoteCursor } from "@/hooks/use-remote-cursor";
import { useRemoteNavigation } from "@/hooks/use-remote-nav";

/**
 * The mount the whole television runs on.
 *
 * Two hooks and one element, and both hooks are global on purpose:
 *
 * - **`useRemoteCursor`** — the cursor rule. One listener on the window,
 *   which is the only place "did the user just move a mouse" can be
 *   answered for the whole app at once. Mounted once; mounting it per
 *   screen would mean each screen disagreed about the last one.
 * - **`useRemoteNavigation`** — the D-pad. Also one listener on the
 *   window, because a keypress does not arrive at a component, it arrives
 *   at the document and the document has to decide where it goes.
 *
 * The element is `data-tv-nav="root"`, the outermost navigation scope
 * and the one that answers a keypress when nothing is focused yet. Every
 * screen that is reachable by a remote is inside one of these.
 *
 * The navigation bar is deliberately *not* inside it: the bar is fixed
 * and a fixed element cannot be a child of the scrolling content. The
 * engine knows about both and walks the scope chain from one to the
 * other, so a press of "down" from a bar item still reaches the rails.
 */

export type TVShellProps = {
  children: React.ReactNode;
  /**
   * The Back key. The browser's own history step, which is the right
   * answer on a device whose only job is to show one route at a time —
   * inside the app it goes to the previous screen, and at the front door
   * it leaves, which is what a person pressing Back on a front door is
   * asking for.
   */
  onBack?: () => void;
  className?: string;
};

export function TVShell({ children, onBack, className }: TVShellProps) {
  useRemoteCursor();
  useRemoteNavigation({ onBack: onBack ?? (() => window.history.back()) });

  return (
    <main
      data-tv-nav="root"
      data-tv-scroll-behavior="smooth"
      className={className}
    >
      {children}
    </main>
  );
}
