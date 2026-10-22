import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * The furniture the content pages are built from.
 *
 * Everything here follows the design system: depth comes from light, the
 * accent is gold, and the type is the display face for anything that is a
 * title and the UI face for anything that is read.
 */

/** The page's opening statement: eyebrow, headline, lead. */
export function PageHero({
  eyebrow,
  title,
  lead,
  meta,
  children,
  className,
}: {
  /** The small label above the headline. */
  eyebrow: string;
  /** The headline. */
  title: string;
  /** The paragraph under it. */
  lead?: ReactNode;
  /** A row of small facts, separated by middots. */
  meta?: ReactNode;
  /** Anything that sits under the lead — a filter, a link row. */
  children?: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "relative isolate overflow-hidden border-b border-white/[0.06]",
        className,
      )}
    >
      {/* The light that falls on the page. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div
          className="absolute inset-0 mix-blend-screen"
          style={{
            background: [
              "radial-gradient(58% 78% at 12% -10%, hsl(38 92% 52% / 0.22) 0%, transparent 62%)",
              "radial-gradient(46% 62% at 88% 0%, hsl(214 92% 60% / 0.18) 0%, transparent 66%)",
            ].join(", "),
          }}
        />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
        <div className="fx-grain absolute inset-0 opacity-[0.035] mix-blend-overlay" />
      </div>

      <div className="mx-auto max-w-[1800px] px-4 pb-12 pt-14 sm:px-8 sm:pb-16 sm:pt-20 lg:px-12">
        <p className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-signal/85">
          {eyebrow}
        </p>

        <h1 className="mt-3 max-w-4xl font-display text-[clamp(1.9rem,4.4vw,3.25rem)] font-semibold leading-[1.06] tracking-[-0.03em] text-balance">
          {title}
        </h1>

        {lead ? (
          <div className="mt-5 max-w-2xl text-[15px] leading-relaxed text-ink-muted sm:text-base">
            {lead}
          </div>
        ) : null}

        {meta ? (
          <div className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-2 text-[12px] text-ink-faint">
            {meta}
          </div>
        ) : null}

        {children ? <div className="mt-8">{children}</div> : null}
      </div>
    </section>
  );
}

/** A band of content with a heading. */
export function PageSection({
  title,
  eyebrow,
  lead,
  aside,
  children,
  className,
  id,
}: {
  /** The heading. */
  title?: string;
  /** The small label above the heading. */
  eyebrow?: string;
  /** A paragraph under the heading. */
  lead?: ReactNode;
  /** Something on the right of the heading. */
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section id={id} className={cn("mx-auto max-w-[1800px] px-4 sm:px-8 lg:px-12", className)}>
      {(title || eyebrow || aside) && (
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
          <div className="min-w-0">
            {eyebrow ? (
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-signal/85">
                {eyebrow}
              </p>
            ) : null}
            {title ? (
              <h2 className="mt-1.5 font-display text-xl font-semibold tracking-[-0.015em] text-ink sm:text-[26px]">
                {title}
              </h2>
            ) : null}
            {lead ? (
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-muted">
                {lead}
              </p>
            ) : null}
          </div>
          {aside ? <div className="shrink-0">{aside}</div> : null}
        </div>
      )}
      <div className={title || eyebrow || aside ? "mt-7" : undefined}>{children}</div>
    </section>
  );
}

/**
 * A note that says what the site does **not** know.
 *
 * It is the piece of furniture the honest pages are built on: a page that
 * cannot answer says so, in the same visual language as the rest.
 */
export function Note({
  title,
  children,
  tone = "quiet",
  className,
}: {
  title?: string;
  children: ReactNode;
  tone?: "quiet" | "signal";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-panel)] border px-5 py-6 sm:px-7 sm:py-7",
        tone === "signal"
          ? "border-signal/25 bg-signal/[0.07]"
          : "border-white/[0.08] bg-white/[0.025]",
        className,
      )}
    >
      {title ? (
        <p
          className={cn(
            "text-[11px] font-semibold uppercase tracking-[0.2em]",
            tone === "signal" ? "text-signal" : "text-ink-faint",
          )}
        >
          {title}
        </p>
      ) : null}
      <div
        className={cn(
          "text-[14px] leading-relaxed text-ink-muted",
          title ? "mt-3" : undefined,
        )}
      >
        {children}
      </div>
    </div>
  );
}

/** A small fact, set as a chip of light. */
export function Stat({
  label,
  value,
  hint,
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-card)] border border-white/[0.07] bg-white/[0.03] px-4 py-3.5",
        className,
      )}
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-faint">
        {label}
      </p>
      <p className="mt-1.5 font-display text-[19px] font-semibold tracking-tight text-ink tabular-nums">
        {value}
      </p>
      {hint ? <p className="mt-0.5 text-[11.5px] text-ink-faint">{hint}</p> : null}
    </div>
  );
}

/** A glass panel: the standard surface of the content pages. */
export function Panel({
  children,
  className,
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[var(--radius-panel)] border border-white/[0.07] bg-white/[0.03] backdrop-blur-xl",
        className,
      )}
      style={style}
    >
      <div aria-hidden className="fx-sheen absolute inset-0 opacity-60" />
      <div className="relative">{children}</div>
    </div>
  );
}

/** A run of links, used for the cross-links between the guide pages. */
export function LinkRow({
  links,
  label,
  className,
}: {
  links: { label: string; href: string; hint?: string }[];
  label?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap gap-2.5", className)}>
      {label ? (
        <span className="self-center text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-faint">
          {label}
        </span>
      ) : null}
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className="group inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.035] px-3.5 py-1.5 text-[13px] text-ink-muted transition-[transform,border-color,color,background-color] duration-300 ease-spring hover:-translate-y-px hover:border-signal/35 hover:bg-white/[0.07] hover:text-ink"
        >
          {link.label}
          {link.hint ? (
            <span className="text-[11px] text-ink-faint">{link.hint}</span>
          ) : null}
        </Link>
      ))}
    </div>
  );
}

/** A table of contents for a long page. */
export function Contents({
  items,
  label = "Pe această pagină",
}: {
  items: { label: string; href: string }[];
  label?: string;
}) {
  return (
    <nav
      aria-label={label}
      className="rounded-[var(--radius-panel)] border border-white/[0.07] bg-white/[0.025] p-5"
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-faint">
        {label}
      </p>
      <ul className="mt-3.5 space-y-2">
        {items.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className="group inline-flex items-center gap-2 text-[13.5px] text-ink-muted transition-colors duration-300 hover:text-ink"
            >
              <span className="h-px w-0 bg-signal transition-[width] duration-300 ease-spring group-hover:w-3" />
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** Body copy, for the pages that are mostly words. */
export function Prose({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "max-w-3xl text-[15px] leading-[1.75] text-ink-muted [&_a]:text-signal-bright [&_a]:underline [&_a]:decoration-signal/35 [&_a]:underline-offset-4 hover:[&_a]:decoration-signal [&_strong]:font-semibold [&_strong]:text-ink [&_h2]:mt-10 [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:tracking-tight [&_h2]:text-ink [&_h3]:mt-7 [&_h3]:font-display [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-ink [&_li]:mt-2 [&_p]:mt-4 [&_p:first-child]:mt-0 [&_ul]:mt-4 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5",
        className,
      )}
    >
      {children}
    </div>
  );
}
