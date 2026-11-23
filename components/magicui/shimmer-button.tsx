import React, { CSSProperties, ComponentPropsWithoutRef } from "react";

import { Slot } from "radix-ui";

import { cn } from "@/lib/utils";

export interface ShimmerButtonProps extends ComponentPropsWithoutRef<"button"> {
  shimmerColor?: string;
  shimmerSize?: string;
  borderRadius?: string;
  shimmerDuration?: string;
  background?: string;
  className?: string;
  children?: React.ReactNode;
  /** Render the single child element (a Link, usually) as the clickable pill. */
  asChild?: boolean;
}

const ROOT =
  "group relative z-0 flex cursor-pointer items-center justify-center gap-1.5 overflow-hidden whitespace-nowrap border border-white/10 text-[var(--eavi-on-fill)] shadow-[inset_0_1px_0_var(--rim),inset_0_-1px_0_var(--groove),0_3px_8px_-3px_var(--cast)] [background:var(--bg)] [border-radius:var(--radius)] [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4";

const PAD_DEFAULT = "px-6 py-3";

/** Tailwind padding utilities, so a caller's size can move onto the merged child. */
const PAD_PATTERN = /(?:^|\s)(?:p|px|py|pt|pb|pl|pr)-[^\s]+/g;

const SPARK = (
  <div
    className={cn(
      "-z-30 blur-[2px]",
      "absolute inset-0 overflow-visible [container-type:size]",
    )}
  >
    {/* spark */}
    <div className="absolute inset-0 h-[100cqh] animate-shimmer-slide [aspect-ratio:1] [border-radius:0] [mask:none]">
      {/* spark before */}
      <div className="absolute -inset-full w-auto rotate-0 animate-spin-around [background:conic-gradient(from_calc(270deg-(var(--spread)*0.5)),transparent_0,var(--shimmer-color)_var(--spread),transparent_var(--spread))] [translate:0_0]" />
    </div>
  </div>
);

const HIGHLIGHT = (
  <div
    className={cn(
      "insert-0 absolute size-full",

      "rounded-2xl px-4 py-1.5 text-sm font-medium shadow-[inset_0_-8px_10px_#ffffff1f]",

      // transition
      "transform-gpu transition-all duration-300 ease-in-out",

      // on hover
      "group-hover:shadow-[inset_0_-6px_10px_#ffffff3f]",

      // on click
      "group-active:shadow-[inset_0_-10px_10px_#ffffff3f]",
    )}
  />
);

const BACKDROP = (
  <div
    className={cn(
      "absolute -z-20 [background:var(--bg)] [border-radius:var(--radius)] [inset:var(--cut)]",
    )}
  />
);

export const ShimmerButton = React.forwardRef<
  HTMLButtonElement,
  ShimmerButtonProps
>(
  (
    {
      shimmerColor = "#ffffff",
      shimmerSize = "0.05em",
      shimmerDuration = "3s",
      borderRadius = "100px",
      background = "var(--eavi-fill)",
      className,
      children,
      asChild = false,
      ...props
    },
    ref,
  ) => {
    const vars = {
      "--spread": "90deg",
      "--ink": "var(--eavi-on-fill)",
      "--rim": "color-mix(in oklab, white 30%, transparent)",
      "--groove": "color-mix(in oklab, black 26%, transparent)",
      "--cast": "color-mix(in oklab, var(--eavi-neum-lo) 92%, transparent)",
      "--shimmer-color": shimmerColor,
      "--radius": borderRadius,
      "--speed": shimmerDuration,
      "--cut": shimmerSize,
      "--bg": background,
    } as CSSProperties;

    if (asChild) {
      /**
       * The pill is this span but the control is the merged child, so the padding has
       * to travel with it — otherwise the padded ring of a wide button is untappable.
       */
      const requested = className ?? "";
      const pad = cn(PAD_DEFAULT, requested.match(PAD_PATTERN) ?? []);
      const rest = requested.replace(PAD_PATTERN, " ");

      return (
        <span style={vars} className={cn(ROOT, "transform-gpu", rest)}>
          {SPARK}
          <Slot.Root
            className={cn(
              "relative z-10 inline-flex min-h-full min-w-full items-center justify-center gap-1.5 whitespace-nowrap",
              pad,
            )}
            {...(props as ComponentPropsWithoutRef<"a">)}
          >
            {children}
          </Slot.Root>
          {HIGHLIGHT}
          {BACKDROP}
        </span>
      );
    }

    return (
      <button
        style={vars}
        className={cn(
          ROOT,
          PAD_DEFAULT,
          "transform-gpu transition-transform duration-300 ease-in-out active:translate-y-px",
          className,
        )}
        ref={ref}
        {...props}
      >
        {SPARK}
        {children}
        {HIGHLIGHT}
        {BACKDROP}
      </button>
    );
  },
);

ShimmerButton.displayName = "ShimmerButton";
