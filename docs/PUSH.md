# Web push notifications

Real-time browser notifications (the YouTube kind): a bell in the top bar with the
unread count and history, and native device notifications that arrive even when no
EAVI tab is open — Android Chrome and installed PWAs included.

Self-hosted end to end: the Web Push API, a service worker, and VAPID authentication.
No Firebase, no Supabase, no paid service. Delivery rides the existing session auth,
Postgres and Next.js stack.

## Files

| File | What it is |
| --- | --- |
| `prisma/migrations/20261123120000_push_notifications/` | Tables: `push_subscriptions`, `notifications`, `notification_preferences` |
| `lib/notifications/config.ts` | VAPID identity, set on first use (builds need no keys) |
| `lib/notifications/service.ts` | The one sender: `notifyUser(s)`, `notifyRole`, `notifyStudents`, `notifyTutors`, `notifyClass`, `notifyEveryone`; saves rows, then delivers without blocking the request |
| `lib/notifications/api.ts` | Session guard for the push/notify routes |
| `lib/notifications/client.ts` | Browser half: permission, worker registration, subscribe/unsubscribe |
| `app/api/push/subscribe/` | POST (register), DELETE (this device), GET (my devices) |
| `app/api/notifications/` | GET (feed + unread), `read/` POST (mark some/all read), `preferences/` GET/PUT (muted kinds) |
| `public/sw.js` | The service worker: background push, native notification, click → focus or open the right page |
| `components/notifications/notification-bell.tsx` | Bell: unread badge, history, mark read, device toggle, per-kind mutes, in-app toasts |
| `components/shell/topbar.tsx` | Mounts the bell beside the account menu |

## VAPID keys

```bash
npx web-push generate-vapid-keys
```

Put the pair in `.env` (and on the server before first deploy that uses it):

```
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:admin@eavi.ac.ke
NEXT_PUBLIC_VAPID_PUBLIC_KEY=<same as VAPID_PUBLIC_KEY>
```

The public key identifies our server to the browser's push service and is safe to
inline into the client bundle. The private key never leaves the server. Reuse the same
pair everywhere and forever: rotating it invalidates every existing subscription. If
the keys are missing, the feature degrades to the bell-only (in-app) experience; the
first push attempt says so in the logs.

## Deploy

Nothing to hand-install: `public/sw.js` ships with the build and is served at the site
root, so its scope covers the whole origin (required for the bell to subscribe).
Production must be HTTPS — it already is. The migration rides the normal
`prisma migrate deploy` in CI.

## As a student

Open the bell (top bar) → *Push notifications* → **Enable**. The browser asks for
permission; grant it. That device is registered (multiple devices are fine — each one
gets the toggle independently). Disable works the same way. The checkboxes mute a kind
everywhere (announcements / fees / results / messages).

## As an administrator

Sending is built into the existing actions — nothing new to learn:

- **Announcements** (Communication page) notify everyone the notice is for: audience
  (students / tutors / everyone) and scope (campus / college) decide who.
- **Recording a fee payment** (Accounts) notifies the student — amount received and
  the balance still due.
- **Publishing marks** (Exams, or the tutor's marks page) notifies every student with
  a mark on that paper.

A retried action cannot notify the same person twice: each event carries a dedupe key
the database enforces per recipient.

## Testing on Android Chrome

1. Sign in at the portal, tap the bell, **Enable**, grant permission.
2. Close the EAVI tab (or the whole browser), then from the office trigger an event —
   publish an announcement. The notification should appear in the system tray.
3. Tap it: an EAVI tab opens (or the existing one is focused) on the notice.
4. Repeat with a second device (desktop) signed into the same account — both devices
   receive their own copy; either can be disabled independently.

## Limitations

- iOS Safari supports web push only for installed home-screen PWAs (16.4+), and it can
  re-prompt after a few days of non-use.
- Some Android vendors (certain Xiaomi/Huawei builds) kill background workers; when the
  browser process is force-stopped, delivery waits until it is revived.
- A "cleared" browser profile (site data wiped) invalidates its subscription; the dead
  endpoint is removed automatically at the next send (404/410 handling).
- The in-app feed polls every 45 s, so an in-app toast can lag a push by up to that
  much; native pushes arrive immediately.
