import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border font-medium tracking-tight transition-colors [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "border-white/12 bg-white/8 text-ink-muted",
        live: "border-live/35 bg-live/12 text-[#ff8b93]",
        signal: "border-signal/35 bg-signal/12 text-signal-bright",
        solid: "border-transparent bg-signal text-[#141005]",
        outline: "border-white/20 bg-transparent text-ink-muted",
      },
      size: {
        xs: "h-5 px-2 text-[10px] uppercase tracking-[0.14em]",
        sm: "h-6 px-2.5 text-[11px] uppercase tracking-[0.12em]",
        md: "h-7 px-3 text-xs",
      },
    },
    defaultVariants: { variant: "default", size: "sm" },
  },
);

export type BadgeProps = React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants>;

export function Badge({ className, variant, size, ...props }: BadgeProps) {
  return (
    <span
      data-slot="badge"
      className={cn(badgeVariants({ variant, size }), className)}
      {...props}
    />
  );
}

export { badgeVariants };
