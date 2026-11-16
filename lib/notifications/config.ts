import { setVapidDetails } from "web-push";

/**
 * VAPID identity for web push.
 *
 * Like the queue's Redis config, nothing here connects and nothing is evaluated until a
 * caller asks: the build has no keys and must not need them. The private key never
 * leaves the server — the browser only ever sees the public key, which is public by
 * design (it is sent with every subscription request the browser makes to the push
 * service).
 */

export function pushConfigured(): boolean {
  return Boolean(
    process.env.VAPID_PUBLIC_KEY &&
      process.env.VAPID_PRIVATE_KEY &&
      process.env.VAPID_SUBJECT,
  );
}

let configured = false;

/** Sets the VAPID identity once per process; throws when the deployment has no keys. */
export function vapid(): void {
  if (configured) return;

  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;

  if (!publicKey || !privateKey || !subject) {
    throw new Error(
      "VAPID keys are not set. Generate a pair with `npx web-push generate-vapid-keys` " +
        "and set VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY and VAPID_SUBJECT in .env.",
    );
  }

  setVapidDetails(subject, publicKey, privateKey);
  configured = true;
}
