"use client";

import { useEffect, useState } from "react";

import styles from "./review-animation.module.css";

/**
 * The waiting state while an application is reviewed and its letter prepared.
 *
 * A conic-gradient ring (single element, composited) plus a rolling word column — the
 * pattern recommended by current CSS-loader guides. The words advance on a timer, so
 * they describe real stages instead of sitting on one generic "creating PDF" line.
 * Reduced motion shows the first word and a still ring.
 */
export function ReviewAnimation({ steps, hint }: { steps: readonly string[]; hint: string }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (steps.length < 2) return;
    const timer = setInterval(() => setIndex((value) => Math.min(value + 1, steps.length - 1)), 1200);
    return () => clearInterval(timer);
  }, [steps.length]);

  return (
    <div className={styles.root} role="status" aria-live="polite">
      <div className={styles.ring} aria-hidden="true" />
      <div className={styles.dots} aria-hidden="true">
        <span /><span /><span />
      </div>
      <p className={styles.wordWindow} aria-hidden="true">
        <span
          className={styles.wordTrack}
          style={{ transform: `translateY(-${index * 100}%)` }}
        >
          {steps.map((step) => <span key={step} className={styles.word}>{step}</span>)}
        </span>
      </p>
      <p className={styles.srOnly}>{steps[index]}</p>
      <p className={styles.hint}>{hint}</p>
    </div>
  );
}
