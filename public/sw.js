/*
 * EAVI portal service worker — web push delivery and notification clicks.
 *
 * Deliberately dependency-free and cache-free: the portal is not an offline app, so this
 * worker exists only to receive pushes while no tab is open (Android Chrome, installed
 * PWA, a desktop browser that keeps workers alive) and to route notification clicks.
 * Anything fancier risks the very notifications it exists to deliver.
 */

const ORIGIN = self.location.origin;
const ICON = "/card-logo.png";

self.addEventListener("install", () => {
  // A new worker takes over immediately; there is nothing versioned to wait for.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  // A payload the worker cannot parse is still a nudge that something happened: show the
  // generic copy rather than swallowing the event, or the browser may report no
  // notification shown and drop the message silently.
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }

  const title =
    typeof data.title === "string" && data.title.trim() ? data.title.trim().slice(0, 120) : "EAVI College";
  const body =
    typeof data.body === "string" && data.body.trim() ? data.body.trim().slice(0, 240) : "Open the portal for details.";

  // Only in-app paths, only from our own origin: a crafted payload cannot aim the
  // student's browser somewhere else.
  let url = "/";
  if (typeof data.url === "string" && data.url.startsWith("/") && !data.url.startsWith("//")) {
    url = data.url;
  }

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: ICON,
      badge: ICON,
      // One tag per kind: three fee notices collapse into one, but a fee notice and a
      // result notice both stay visible.
      tag: typeof data.type === "string" && data.type ? `eavi-${data.type}` : "eavi",
      data: { url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const target = event.notification.data && typeof event.notification.data.url === "string"
    ? event.notification.data.url
    : "/";
  const url = new URL(target, ORIGIN).href;

  event.waitUntil(
    (async () => {
      // An EAVI tab that already exists is focused and pointed at the page — opening a
      // second tab for every notification would pile up fast on a phone.
      const windowClients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of windowClients) {
        if (!client.url.startsWith(ORIGIN)) continue;
        await client.focus();
        if (client.url !== url && "navigate" in client) {
          try {
            await client.navigate(url);
          } catch {
            // Focusing the portal is already most of the job; a failed navigation
            // (say, a page the tab cannot replace) leaves the portal open on the home.
          }
        }
        return;
      }
      await self.clients.openWindow(url);
    })(),
  );
});
