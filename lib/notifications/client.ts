"use client";

/**
 * The browser half of web push: permission, the service worker, and the subscription
 * row's mirror on the server. Used by the bell's enable/disable controls.
 *
 * The VAPID public key is public by design — it identifies our server to the push
 * service. The private key lives only in the server's environment and is never imported
 * here.
 */

const ENDPOINT_KEY = "eavi:push-endpoint";
const SW_PATH = "/sw.js";

export type PushSetupResult = { ok: true } | { ok: false; reason: string };

export function pushSupported(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window;
}

/**
 * The public VAPID key comes from a tiny runtime route, not from a NEXT_PUBLIC_ build
 * variable: that value was repeatedly missing from the compiled browser bundle in Docker
 * (build args are easy to lose), and push silently refused to switch on. The key is
 * public by design, so serving it to a signed-in browser loses nothing.
 */
async function applicationServerKey(): Promise<Uint8Array | null> {
  let raw: string | null = null;
  try {
    const response = await fetch("/api/push/config", { cache: "no-store" });
    if (response.ok) {
      const data = (await response.json()) as { publicKey?: string };
      raw = typeof data.publicKey === "string" && data.publicKey ? data.publicKey : null;
    }
  } catch {
    return null;
  }
  if (!raw) return null;
  // The key arrives URL-safe base64; the subscription call wants the raw bytes.
  const padding = "=".repeat((4 - (raw.length % 4)) % 4);
  const base64 = (raw + padding).replace(/-/g, "+").replace(/_/g, "/");
  const bytes = window.atob(base64);
  const output = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i += 1) output[i] = bytes.charCodeAt(i);
  return output;
}

/** A short, human name for the device list: "Android phone", "Desktop Chrome", … */
function deviceName(): string {
  const ua = navigator.userAgent;
  if (/Android/i.test(ua)) return /Mobi/i.test(ua) ? "Android phone" : "Android tablet";
  if (/iPhone|iPad|iPod/i.test(ua)) return "iPhone / iPad";
  if (/Macintosh/i.test(ua)) return "Mac";
  if (/Windows/i.test(ua)) return "Windows PC";
  if (/Linux/i.test(ua)) return "Linux desktop";
  return "This device";
}

async function ensureRegistration(): Promise<ServiceWorkerRegistration> {
  const swReg = await navigator.serviceWorker.register(SW_PATH);
  // The subscription call needs the worker that is actually in control, not merely registered.
  await navigator.serviceWorker.ready;
  return swReg;
}

async function postSubscription(subscription: PushSubscription): Promise<boolean> {
  const json = subscription.toJSON();
  if (!json.endpoint) return false;
  const response = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      endpoint: json.endpoint,
      keys: json.keys,
      deviceName: deviceName(),
    }),
  });
  if (!response.ok) return false;
  localStorage.setItem(ENDPOINT_KEY, json.endpoint);
  return true;
}

/** Permission → worker → subscription → server row. Each step reports its own failure. */
export async function enablePush(): Promise<PushSetupResult> {
  if (!pushSupported()) {
    return { ok: false, reason: "This browser does not support push notifications." };
  }
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    return {
      ok: false,
      reason:
        permission === "denied"
          ? "Notifications were blocked in the browser settings. Re-allow them for this site, then try again."
          : "Notifications were dismissed. You can enable them again any time.",
    };
  }

  try {
    const swReg = await ensureRegistration();
    const key = await applicationServerKey();
    if (!key) return { ok: false, reason: "Notifications are not configured on the server yet." };

    const existing = await swReg.pushManager.getSubscription();
    const subscription =
      existing ??
      (await swReg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: key as BufferSource,
      }));

    const saved = await postSubscription(subscription);
    if (!saved) return { ok: false, reason: "The subscription could not be saved. Try again." };

    return { ok: true };
  } catch {
    return { ok: false, reason: "The browser refused the subscription. Refresh and try again." };
  }
}

/** Removes this device's subscription from the browser and from the server. */
export async function disablePush(): Promise<PushSetupResult> {
  if (!pushSupported()) return { ok: false, reason: "Push is not supported here." };

  try {
    const registration = await navigator.serviceWorker.getRegistration();
    const subscription = await registration?.pushManager.getSubscription();
    const endpoint = subscription?.endpoint ?? localStorage.getItem(ENDPOINT_KEY);

    if (subscription) await subscription.unsubscribe();
    if (endpoint) {
      await fetch("/api/push/subscribe", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ endpoint }),
      });
    }
    localStorage.removeItem(ENDPOINT_KEY);
    return { ok: true };
  } catch {
    return { ok: false, reason: "The unsubscribe could not be completed. Try again." };
  }
}

/** What the bell shows: the browser's permission and whether this device is subscribed. */
export async function pushStatus(): Promise<{ permission: string; subscribed: boolean }> {
  if (!pushSupported()) return { permission: "unsupported", subscribed: false };

  const registration = await navigator.serviceWorker.getRegistration();
  const subscription = await registration?.pushManager.getSubscription();
  const serverKnows = Boolean(subscription && localStorage.getItem(ENDPOINT_KEY) === subscription.endpoint);

  return { permission: Notification.permission, subscribed: Boolean(subscription) && serverKnows };
}
