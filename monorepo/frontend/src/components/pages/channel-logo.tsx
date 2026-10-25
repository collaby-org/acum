"use client";

import Image from "next/image";
import { useState } from "react";

/**
 * A channel logo, with a fallback.
 *
 * `next/image` is a client component, so an error handler cannot be passed
 * to it from a server component. The fallback therefore lives here, in a
 * small island: when the catalogue points at a logo the site does not ship,
 * the initial takes over instead of a broken image.
 */
export function ChannelLogoImage({
  src,
  name,
  className,
  sizes,
}: {
  /** The logo's path, when the channel has one. */
  src: string | null;
  /** The channel's name — the initial is taken from it. */
  name: string;
  /** The classes for the image itself. */
  className?: string;
  /** The sizes hint for the image. */
  sizes?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <span
        aria-hidden
        className="font-display text-[11px] font-bold text-ink-muted"
      >
        {name.slice(0, 2).toUpperCase()}
      </span>
    );
  }

  return (
    <Image
      src={src}
      alt=""
      width={64}
      height={36}
      unoptimized
      sizes={sizes}
      className={className}
      onError={() => setFailed(true)}
    />
  );
}
