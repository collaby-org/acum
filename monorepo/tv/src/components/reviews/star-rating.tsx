"use client";

import { Star } from "lucide-react";
import { TVFocusable } from "@/components/tv/focusable";
import { cn } from "@/lib/utils";

/**
 * The rating.
 *
 * One component, two faces, because a star is read and a star is set and
 * they are the same five shapes doing it. The reading face is present in
 * every list row and fills according to the review; the setting face is
 * the one the composer uses and is a radio group, not a slider — a
 * rating is one of five values, not a dial, and the keyboard goes through
 * it as five choices.
 */

/** A rating, drawn. Filled to the number, outlined above it. */
export function Stars({
  value,
  className,
  size = "sm",
}: {
  value: number;
  className?: string;
  size?: "sm" | "md";
}) {
  return (
    <span
      className={cn("inline-flex items-center gap-0.5", className)}
      role="img"
      aria-label={`${value} din 5 stele`}
    >
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          aria-hidden
          className={cn(
            size === "sm" ? "size-3.5" : "size-5",
            star <= value
              ? "fill-signal text-signal"
              : "fill-transparent text-ink-faint",
          )}
        />
      ))}
    </span>
  );
}

/** A rating, chosen. Five keys, one of them on. */
export function StarPicker({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (rating: number) => void;
  disabled?: boolean;
}) {
  return (
    // The hit area is 44 px — the same size as the reaction row beside it
    // and the same size as the stars in the web application. One control,
    // one size, in both products.
    <div
      role="radiogroup"
      aria-label="Rating"
      className="inline-flex items-center gap-1"
    >
      {[1, 2, 3, 4, 5].map((star) => {
        const active = star <= value;
        return (
          <TVFocusable
            key={star}
            role="radio"
            aria-checked={value === star}
            aria-label={`${star} ${star === 1 ? "stea" : "stele"}`}
            disabled={disabled}
            onClick={() => onChange(star)}
            className={cn(
              "grid size-11 place-items-center rounded-full",
              "disabled:pointer-events-none",
            )}
          >
            <Star
              aria-hidden
              className={cn(
                "size-6",
                active
                  ? "fill-signal text-signal"
                  : "fill-transparent text-ink-faint",
              )}
            />
          </TVFocusable>
        );
      })}
    </div>
  );
}
