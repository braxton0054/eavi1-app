# Chat

A school-wide messenger: anyone signed in can message anyone else. Admins, tutors and students
all share one screen; the tick next to a name says which they are.

## How it is put together

| Piece | Where | Notes |
| --- | --- | --- |
| Schema + migration | `prisma/schema.prisma`, `prisma/migrations/20261120000000_chat` | Conversations, members, messages, receipts, blocks, reports, restrictions |
| Safe profile | `lib/chat/profile.ts` | The only description of a person chat may return |
| Access rules | `lib/chat/access.ts` | Membership, posting, restrictions, blocks |
| Contacts / threads | `lib/chat/conversations.ts` | Phonebook, ORDER BY seed, DIRECT pair key |
| Sending | `lib/chat/messages.ts` | One function used by both socket and HTTP |
| Socket | `lib/chat/socket.ts` | Handshake auth, rooms, presence, typing |
| Custom server | `server.ts` → `server.mjs` | Next plus Socket.IO on one port |
| API | `app/api/chat/**` | Contacts, conversations, messages, block, mute, report, avatar |
| UI | `components/chat/**`, `app/(portal)/portal/chat` | Two panes on desktop, one on a phone |
| Tests | `scripts/verify-chat.ts` | Privacy, permissions, rate limits, socket payloads |

## Running it

```bash
npm install
npx prisma migrate deploy      # applies the chat migration
npm run dev                    # builds server.mjs, then starts Next + Socket.IO on :3000
```

`npm run dev` no longer runs `next dev` directly. `server.ts` is compiled to `server.mjs` by
`scripts/build-server.mjs` first, because Next's App Router needs AsyncLocalStorage, which the
`tsx` transform breaks, and because a pre-compiled file needs no TypeScript tooling in the
production image.

Production: `npm start` (same build step, `NODE_ENV=production`). The Docker image runs
`node server.mjs` rather than Next's standalone `server.js`, since only the former has the
socket attached.

### Testing locally over HTTPS

WebSockets, notifications and service workers all behave differently outside a secure context.
`http://localhost` counts as secure, so the normal `npm run dev` is enough for chat and presence.
To exercise the PWA and background behaviour, put a TLS proxy in front:

```bash
npx local-ssl-proxy --source 3443 --target 3000
```

Then browse `https://localhost:3443`.

## Environment

| Variable | Needed for |
| --- | --- |
| `DATABASE_URL` | Everything |
| `S3_*` | Avatars in chat (thumbnails are cut from the stored photo) |

Chat has no variables of its own. `server.ts` loads `.env` before anything else imports, because
the Prisma client reads `DATABASE_URL` at module load time.

## Rules the code enforces

- **The socket trusts nothing.** The handshake reads the portal's own session cookie; every
  `chat:join` and every send re-checks membership in the database.
- **Only four fields describe a person**: id, name, thumbnail URL, role. There is no field in
  `ChatProfile` for an admission number, a phone number or an email, so no query built on it can
  leak one.
- **Names are searched, admission numbers never are.** Typing an admission number into Contacts
  returns nobody, which is also why it cannot be used to confirm one.
- **Avatars go through `/api/chat/avatar/[userId]`**, signed-in only, cropped to 96 or 256 px.
  The full-size enrolment photo is never handed to the browser.
- **Rate limits**: ~20 messages per 10 seconds, 30 new DIRECT threads per hour, per user, held
  in memory. **A second server instance would need these moved to Redis** — the buckets are
  per-process.
- **One DIRECT thread per pair**, guaranteed by the unique `directKey` rather than by checking
  first, so two racing tabs cannot create two threads.

## Known limitations

- **iOS can only receive browser notifications when the portal is installed to the home screen**
  (Share → Add to Home Screen). In a normal Safari tab there is no notification permission at all.
- **Presence is single-instance.** Joining/leaving is tracked in the process's memory. With more
  than one container, presence and typing indicators would need the Socket.IO Redis adapter.
- **Web push is not implemented.** The notification you see while the tab is open comes from the
  socket; there is no service worker push, so a fully closed browser gets nothing yet. The schema
  and the `chat:message-notify` event are the seams a push worker would plug into.
- **Attachments are not implemented.** Images and PDFs are phase 2; nothing in the schema blocks
  them, and message bodies are plain text with a 2,000 character limit.
- **Broadcast is not implemented.** The conversation types are DIRECT, CLASS and GROUP; a
  broadcast-to-a-campus composer is phase 2.
- **Deleting a message is soft** and the row stays for moderation, so a reported message can
  still be reviewed after the author removed it.

## Documents in chat

Files are shared from the paperclip beside the composer, and they delete themselves after **7 days**.

**Files are private.** They are uploaded with `ACL: private` and never given a public URL. Downloads
go through `/api/chat/attachments/[id]`, which re-checks conversation membership on every request.
A copied link therefore stops working when the file expires or the person leaves the conversation —
a public bucket URL would have outlived both.

**What can be shared:** PDF, JPEG, PNG, WebP, plain text, Word and Excel — 10 MB maximum. The
declared type must agree with the file extension, so a renamed file is refused. Everything is
served with `Content-Disposition: attachment` and `nosniff`, so a shared file can never render as a
page on our own origin; images preview inline through the same authenticated route.

**Deletion** is done by a sweep, not by a timer on the row:

```bash
npm run chat:sweep          # hourly cron on the host
```

or, where cron cannot reach the container, a scheduler calls:

```bash
curl -X POST https://<host>/api/internal/sweep-attachments \
  -H "Authorization: Bearer $CHAT_SWEEP_TOKEN"
```

`CHAT_SWEEP_TOKEN` unset means the endpoint refuses everything (503) rather than defaulting open.
The sweep deletes the object first and marks the row second, so a crash leaves a retryable row
rather than an unreachable file. A message whose only content was the file is removed; one that
still has text stays, with the document gone.

## Class groups

A class is a grouping, so its group chat is derived from the class rather than created by hand.
`lib/chat/class-rooms.ts` recomputes membership from the roster:

- **Students** come from open `ClassMembership` rows.
- **Tutors** come from `ClassTutor` — the only definition of "responsible for this class".

The sync runs on enrolment, class creation, student moves, class merges, and archiving.
`maySeeClassRoom` is the visibility rule: a student must be enrolled, a tutor must be assigned, an
administrator must be at the campus. **A class group is not visible to anyone outside the class.**

A new class default to `ALL_MEMBERS` posting: a class group exists so students can ask questions.
`PostingMode.STAFF_ONLY` remains available for a room the office wants to use as a noticeboard.

Verified by `npm run verify:class-rooms` (18 checks) — one room per class, roster-exact membership,
outsiders refused by both membership and by guessing the id, and leave/rejoin preserving access.

## Presence

Being online means **using the portal**, not having the chat screen open. Someone reading a
student's fees is reachable, and showing them offline because they closed one tab is misleading.

Presence is read from `Session.lastSeenAt`, which `resolveSession` already writes on every
authenticated request to any page, plus live sockets so the dot appears immediately. A session
counts as online for 90 seconds after its last request. `showLastSeen` hides a person's status from
everyone else; they still see other people's — the asymmetry is what makes the setting meaningful.
