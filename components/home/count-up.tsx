"use client";

import { useLayoutEffect, useRef } from "react";

/**
 * The finished number is server-rendered, so nothing lies in the HTML and there is no
 * layout shift; the count is a decoration played once when it scrolls into view.
 */
export function CountUp({
  value,
  duration = 1100,
}: {
  value: number;
  duration?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let frame = 0;
    let start = 0;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return;
        observer.disconnect();

        const step = (now: number) => {
          start ||= now;
          const progress = Math.min((now - start) / duration, 1);
          node.textContent = String(Math.round(value * (1 - (1 - progress) ** 3)));
          if (progress < 1) frame = requestAnimationFrame(step);
        };
        frame = requestAnimationFrame(step);
      },
      { threshold: 0.4 },
    );

    observer.observe(node);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [value, duration]);

  return <span ref={ref} className="tabular-nums">{value}</span>;
}
