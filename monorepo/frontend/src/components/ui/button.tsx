import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-medium transition-[transform,background-color,color,border-color,box-shadow] duration-200 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal disabled:pointer-events-none disabled:opacity-45 active:scale-[0.98] [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary:
          "bg-signal text-[#141005] shadow-[0_8px_28px_-10px_rgba(240,165,0,0.85)] hover:bg-signal-bright",
        secondary:
          "bg-white/8 text-ink backdrop-blur-md hover:bg-white/14 border border-white/10",
        ghost: "text-ink-muted hover:text-ink hover:bg-white/8",
        outline:
          "border border-white/18 text-ink hover:border-signal/70 hover:text-signal-bright hover:bg-signal/8",
        live: "bg-live text-white hover:bg-[#ff5560]",
      },
      size: {
        sm: "h-8 px-3 text-[13px]",
        md: "h-10 px-5 text-sm",
        lg: "h-12 px-6 text-[15px]",
        icon: "size-10 p-0",
        "icon-sm": "size-8 p-0",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    /** Render the child element instead of a <button>, keeping the styles. */
    asChild?: boolean;
  };

export function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}

export { buttonVariants };
