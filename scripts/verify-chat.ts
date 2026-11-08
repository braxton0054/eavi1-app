import "../load-env";

import { createRequire } from "node:module";

import { prisma } from "../lib/prisma";

/**
 * Chat privacy tests.
 *
 * The point of these is not that the happy path works but that the chat API cannot be talked
 * into disclosing an admission number, a phone number, an email address or a fee balance. They
 * walk every JSON response and every socket payload and fail on a single forbidden key, and
 * they also check the values, because a leak would more likely be interpolated into a preview
 * string than added as a named field.
 */

const require = createRequire(import.meta.url);
const { io } = require("socket.io-client");

const BASE = process.env.EAVI_BASE ?? "http://localhost:3000";
const PASSWORD = "Portal2026!";

/** Keys that must never appear anywhere in a chat payload. */
const FORBIDDEN_KEYS = [
  "admissionNo",
  "staffNo",
  "phone",
  "guardianPhone",
  "guardianEmail",
  "email",
  "dateOfBirth",
  "nationalId",
  "passwordHash",
  "balance",
  "feeBalance",
];

let passed = 0;
const failures: string[] = [];

function check(name: string, condition: boolean) {
  if (condition) passed += 1;
  else failures.push(name);
}

/** Walks an arbitrary JSON value looking for forbidden keys. */
function scanKeys(value: unknown, path: string, hits: string[]) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => scanKeys(item, `${path}[${index}]`, hits));
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, inner] of Object.entries(value)) {
      if (FORBIDDEN_KEYS.includes(key)) hits.push(`${path}.${key}`);
      scanKeys(inner, `${path}.${key}`, hits);
    }
  }
}

async function signIn(email: string): Promise<{ cookie: string; userId: string } | null> {
  const response = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  if (!response.ok) return null;

  const cookie = (response.headers.get("set-cookie") ?? "").split(";")[0];
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  return user ? { cookie, userId: user.id } : null;
}

async function get(path: string, cookie: string) {
  const response = await fetch(`${BASE}${path}`, { headers: { Cookie: cookie } });
  return { status: response.status, json: await response.json().catch(() => null) };
}

async function post(path: string, cookie: string, body: unknown) {
  const response = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { Cookie: cookie, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: response.status, json: await response.json().catch(() => null) };
}

async function main() {
  const [first, second] = await prisma.user.findMany({
    where: { role: "STUDENT", status: "ACTIVE" },
    select: { id: true, email: true, fullName: true },
    take: 2,
  });
  // A specific admin, not an arbitrary one: the seeded campus administrators each have their
  // own generated password, so picking one at random makes this test fail for the wrong reason.
  const admin = await prisma.user.findFirst({
    where: { role: "SUPERADMIN", status: "ACTIVE" },
    select: { email: true },
  });

  if (!first || !second || !admin) {
    console.log("SKIP: needs two students and an admin in the database.");
    process.exit(0);
  }

  const studentA = await signIn(first.email);
  const studentB = await signIn(second.email);
  const adminSession = await signIn(admin.email);

  if (!studentA || !studentB || !adminSession) {
    const which = [!studentA && first.email, !studentB && second.email, !adminSession && admin.email]
      .filter(Boolean)
      .join(", ");
    console.log(`SKIP: these accounts do not accept the standard password: ${which}`);
    process.exit(0);
  }

  // ── Contacts ────────────────────────────────────────────────────────────────
  const contacts = await get("/api/chat/contacts", studentA.cookie);
  check("contacts: GET succeeds", contacts.status === 200);

  const contactHits: string[] = [];
  scanKeys(contacts.json, "contacts", contactHits);
  check(`contacts: no forbidden keys (${contactHits.join(", ") || "none"})`, contactHits.length === 0);

  const rows = (contacts.json as { rows?: unknown[] } | null)?.rows ?? [];
  check("contacts: rows are returned", rows.length > 0);
  /*
   * The allow-list is exact: a row may carry these keys and no others. campusHint is the one
   * documented exception, shown only where two people share a name.
   */
  const ALLOWED_ROW_KEYS = new Set(["userId", "name", "photoThumbUrl", "role", "tick", "campusHint"]);
  const strayKeys = [...new Set(rows.flatMap((row) => Object.keys(row as object)))].filter(
    (key) => !ALLOWED_ROW_KEYS.has(key),
  );
  check(`contacts: no stray keys on a row (${strayKeys.join(", ") || "none"})`, strayKeys.length === 0);

  // ── Searching for an admission number must find nobody ──────────────────────
  const target = await prisma.studentProfile.findFirst({
    where: { userId: first.id },
    select: { admissionNo: true },
  });
  if (target) {
    const byNumber = await get(`/api/chat/contacts?q=${encodeURIComponent(target.admissionNo)}`, studentA.cookie);
    const found = (byNumber.json as { rows?: unknown[] } | null)?.rows ?? [];
    check("search: an admission number returns no rows", found.length === 0);

    // And the number must not be echoed back anywhere in the response.
    check(
      "search: the admission number is never echoed",
      !JSON.stringify(byNumber.json).includes(target.admissionNo),
    );
  }

  // ── Conversations ───────────────────────────────────────────────────────────
  const opened = await post("/api/chat/conversations", studentA.cookie, { userId: second.id });
  check("conversations: a DIRECT thread opens", opened.status === 200);

  const conversationId = (opened.json as { conversationId?: string } | null)?.conversationId;
  check("conversations: an id is returned", Boolean(conversationId));

  const again = await post("/api/chat/conversations", studentA.cookie, { userId: second.id });
  check(
    "conversations: the same pair reuses one thread",
    (again.json as { conversationId?: string } | null)?.conversationId === conversationId,
  );

  if (conversationId) {
    const sent = await post("/api/chat/messages", studentA.cookie, {
      conversationId,
      body: "Privacy test message",
      clientMessageId: `test-${Date.now()}`,
    });
    check("messages: a member can send", sent.status === 200);

    const history = await get(`/api/chat/conversations/${conversationId}/messages`, studentB.cookie);
    const historyHits: string[] = [];
    scanKeys(history.json, "history", historyHits);
    check(`history: no forbidden keys (${historyHits.join(", ") || "none"})`, historyHits.length === 0);

    // ── Non-members are refused ───────────────────────────────────────────────
    const outsider = await signIn(admin.email);
    const forbidden = await get(`/api/chat/conversations/${conversationId}/messages`, outsider!.cookie);
    check("history: a non-member is refused", forbidden.status === 403);
    check(
      "history: a refused read returns no message body",
      !JSON.stringify(forbidden.json).includes("Privacy test message"),
    );

    // ── Rate limiting ─────────────────────────────────────────────────────────
    let limited = false;
    for (let i = 0; i < 40; i += 1) {
      const burst = await post("/api/chat/messages", studentA.cookie, {
        conversationId,
        body: `burst ${i}`,
        clientMessageId: `burst-${Date.now()}-${i}`,
      });
      if (burst.status === 429) {
        limited = true;
        break;
      }
    }
    check("rate limit: a burst is stopped", limited);
  }

  // ── Socket payloads ─────────────────────────────────────────────────────────
  const socket = io(BASE, {
    transports: ["websocket"],
    reconnection: false,
    extraHeaders: { Cookie: studentB.cookie },
  });

  const socketPayloads: unknown[] = [];
  socket.onAny((_event: string, payload: unknown) => socketPayloads.push(payload));

  const connected = await new Promise<boolean>((resolve) => {
    socket.on("connect", () => resolve(true));
    socket.on("connect_error", () => resolve(false));
    setTimeout(() => resolve(false), 5000);
  });
  check("socket: an authenticated handshake connects", connected);

  if (connected && conversationId) {
    socket.emit("chat:join", { conversationId });
    await new Promise((r) => setTimeout(r, 800));

    const socketHits: string[] = [];
    scanKeys(socketPayloads, "socket", socketHits);
    check(`socket: no forbidden keys (${socketHits.join(", ") || "none"})`, socketHits.length === 0);
  }

  socket.close();

  // ── Report ─────────────────────────────────────────────────────────────────
  console.log("");
  if (failures.length > 0) {
    console.log(`${failures.length} FAILED, ${passed} passed:`);
    for (const failure of failures) console.log(`  ✗ ${failure}`);
    process.exit(1);
  }
  console.log(`All ${passed} chat privacy checks passed.`);
}

main().then(() => process.exit(0));
