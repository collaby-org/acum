/**
 * The one place that decides how a channel opens.
 *
 * On a phone a channel is a page — `/canal/<id>` — because a dialog on a
 * 390 pixel screen is a picture with a caption under it and no way out.
 * On a desktop it is the dialog it has always been.
 *
 * The decision is read from the media queries, not from the user agent:
 * a coarse pointer and a narrow viewport mean a phone, and the queries are
 * re-read when they change, so a tablet that is turned sideways or a
 * desktop window that is dragged narrow both land on the right side.
 */
"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Channel } from "@/data/types";
import { useRecentlyWatched } from "@/hooks/use-favorites";
import { useAccount } from "@/hooks/use-account";

/** A phone: it is touched, and it is narrow. */
const PHONE_QUERY = "(pointer: coarse) and (max-width: 640px)";

export type ChannelLauncher = {
  /** Open a channel: a full-screen route on a phone, the dialog on a desktop. */
  open: (channel: Channel) => void;
  /** The channel currently open, or null. */
  active: Channel | null;
  /** True when the player is open. */
  isOpen: boolean;
  /** Close it. */
  close: () => void;
};

export function useChannelLauncher(): ChannelLauncher {
  const router = useRouter();
  const recent = useRecentlyWatched();
  const account = useAccount();

  const [active, setActive] = useState<Channel | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isPhone, setIsPhone] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia(PHONE_QUERY).matches,
  );

  useEffect(() => {
    const query = window.matchMedia(PHONE_QUERY);
    const sync = () => setIsPhone(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  const open = useCallback(
    (channel: Channel) => {
      // The channel counts as watched either way: the rail of "recently
      // watched" has to know about the phone route too.
      recent.remember(channel.id);

      // Check if user is authenticated
      if (!account.ready) return; // Don't block — wait for account to load
      if (!account.signedIn) {
        router.push("/conturi");
        return;
      }

      if (isPhone) {
        router.push(`/canal/${channel.id}`);
        return;
      }

      setActive(channel);
      setIsOpen(true);
    },
    [isPhone, recent, router, account.ready, account.signedIn],
  );

  const close = useCallback(() => {
    setIsOpen(false);
    setActive(null);
  }, []);

  return { open, active, isOpen, close };
}
