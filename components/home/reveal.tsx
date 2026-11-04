"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";
import { cn } from "cn";

/**
 * Below-the-fold blocks fade up once when they scroll in. The hidden state is added by
 * script only, so the server HTML — and visitors with JavaScript off — see the content
 * immediately, and `prefers-reduced-motion` is handled in CSS.
 */
export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (node.getBoundingClientRect().top < window.innerHeight) return;

    node.classList.add("eavi-reveal--hidden");
    if (delay > 0) node.style.transitionDelay = `${delay}s`;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return;
        node.classList.remove("eavi-reveal--hidden");
        observer.disconnect();
      },
      { rootMargin: "-40px 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [delay]);

  return (
    <div ref={ref} className={cn("eavi-reveal", className)}>
      {children}
    </div>
  );
}
