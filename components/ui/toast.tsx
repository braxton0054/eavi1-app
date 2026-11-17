"use client";

import * as React from "react";
import {
  CircleCheckIcon,
  InfoIcon,
  OctagonXIcon,
  TriangleAlertIcon,
  XIcon,
} from "lucide-react";

import styles from "./toast.module.css";

export type ToastVariant = "default" | "success" | "error" | "warning" | "info";

export type ToastOptions = {
  /** One short sentence: what happened. */
  title: string;
  /** Optional second line: what to do about it. */
  description?: string;
  variant?: ToastVariant;
  /** Milliseconds on screen. Defaults to 5000 (CMP-62). */
  duration?: number;
};

type ToastItem = ToastOptions & { id: number };

const ToastContext = React.createContext<((options: ToastOptions) => void) | null>(null);

/** Shows a toast. Must be called from a client component under the provider. */
export function useToast() {
  const push = React.useContext(ToastContext);
  if (!push) {
    throw new Error("useToast must be used inside <ToastProvider>");
  }
  return push;
}

const ICONS: Record<ToastVariant, React.ReactNode> = {
  default: <InfoIcon />,
  success: <CircleCheckIcon />,
  error: <OctagonXIcon />,
  warning: <TriangleAlertIcon />,
  info: <InfoIcon />,
};

/**
 * Toasts. A short-lived message about something that just happened, never a
 * substitute for an error shown next to the field that caused it (CMP-61, CMP-62).
 *
 * They sit at the bottom of the screen, clear of the mobile navigation bar, pause
 * while the pointer or focus is on them, and are announced politely.
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = React.useState<ToastItem[]>([]);
  const timers = React.useRef(new Map<number, ReturnType<typeof setTimeout>>());
  const remaining = React.useRef(new Map<number, number>());
  const startedAt = React.useRef(new Map<number, number>());

  const dismiss = React.useCallback((id: number) => {
    setItems((current) => current.filter((item) => item.id !== id));
    const timer = timers.current.get(id);
    if (timer) clearTimeout(timer);
    timers.current.delete(id);
    remaining.current.delete(id);
    startedAt.current.delete(id);
  }, []);

  const schedule = React.useCallback(
    (id: number, ms: number) => {
      const timer = setTimeout(() => dismiss(id), ms);
      timers.current.set(id, timer);
      startedAt.current.set(id, Date.now());
    },
    [dismiss],
  );

  const push = React.useCallback(
    (options: ToastOptions) => {
      const id = Date.now() + Math.random();
      const duration = options.duration ?? 5000;
      setItems((current) => [...current.slice(-3), { ...options, id }]);
      remaining.current.set(id, duration);
      schedule(id, duration);
    },
    [schedule],
  );

  /** Pause the countdown while the toast is being read. */
  const pause = React.useCallback(
    (id: number) => {
      const timer = timers.current.get(id);
      if (!timer) return;
      clearTimeout(timer);
      timers.current.delete(id);
      const left = remaining.current.get(id) ?? 0;
      remaining.current.set(id, left - (Date.now() - (startedAt.current.get(id) ?? Date.now())));
    },
    [],
  );

  const resume = React.useCallback(
    (id: number) => {
      if (timers.current.has(id)) return;
      schedule(id, Math.max(remaining.current.get(id) ?? 0, 1000));
    },
    [schedule],
  );

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div
        className={styles.viewport}
        role="status"
        aria-live="polite"
        aria-atomic="false"
      >
        {items.map((item) => (
          <div
            key={item.id}
            className={styles.toast}
            data-slot="toast"
            data-variant={item.variant ?? "default"}
            onMouseEnter={() => pause(item.id)}
            onMouseLeave={() => resume(item.id)}
            onFocusCapture={() => pause(item.id)}
            onBlurCapture={() => resume(item.id)}
          >
            <span className={styles.icon}>{ICONS[item.variant ?? "default"]}</span>
            <div className={styles.body}>
              <p className={styles.title}>{item.title}</p>
              {item.description ? (
                <p className={styles.description}>{item.description}</p>
              ) : null}
            </div>
            <button
              type="button"
              className={styles.close}
              onClick={() => dismiss(item.id)}
            >
              <XIcon />
              <span className="srOnly">Dismiss</span>
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export { ToastProvider as Toast };
