import { createRequire } from "node:module";
const require = createRequire("/home/brax/Desktop/eavi1-app/");
const { chromium } = require("playwright-core");

const BASE = "http://localhost:3000";
let failures = 0;
const check = (name, pass, detail = "") => {
  if (!pass) failures += 1;
  console.log(`  ${pass ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
};

const b = await chromium.launch({ executablePath: "/usr/bin/chromium", args: ["--no-sandbox"] });

async function session(email) {
  const c = await b.newContext({ viewport: { width: 390, height: 844 } });
  const r = await c.request.post(`${BASE}/api/auth/login`, {
    data: { email, password: "Portal2026!" },
  });
  if (!r.ok()) throw new Error(`login failed for ${email}`);
  return c;
}

console.log("chat documents\n");

const student = await session("amos.kiptoo@example.com");

// Find a conversation to post into.
const convs = await (await student.request.get(`${BASE}/api/chat/conversations`)).json();
const conv = convs.rows?.[0] ?? convs.conversations?.[0];
if (!conv) {
  console.log("  SKIP no conversation for the test student");
  await b.close();
  process.exit(0);
}
console.log(`  using conversation ${conv.id.slice(0, 8)} (${conv.type})`);

// 1. A plain text file is accepted.
const form = new FormData();
form.set("conversationId", conv.id);
form.set("body", "sharing a note");
form.set("clientMessageId", `test-${Date.now()}`);
form.set("file", new File([new TextEncoder().encode("hello from a test")], "note.txt", { type: "text/plain" }));

const upload = await student.request.post(`${BASE}/api/chat/attachments`, { multipart: form });
const uploaded = await upload.json();
check("a text file uploads", upload.ok(), `${upload.status()} ${uploaded.error ?? ""}`);
check("the reply carries the message", Boolean(uploaded.message?.id));

const attachment = uploaded.message?.attachments?.[0];
check("the message carries the attachment", Boolean(attachment));
if (!attachment) {
  await b.close();
  process.exit(1);
}

check("the expiry is about seven days away", (() => {
  const days = (new Date(attachment.expiresAt).getTime() - Date.now()) / 86_400_000;
  return days > 6.9 && days < 7.1;
})(), new Date(attachment.expiresAt).toISOString().slice(0, 10));

// The filename is echoed back but is not a path.
check("the filename is preserved and sanitised", !attachment.fileName.includes("/"), attachment.fileName);

// 2. The download works for a member, through our own route.
const download = await student.request.get(`${BASE}/api/chat/attachments/${attachment.id}`);
check("a member can download it", download.ok(), String(download.status()));
check("it is served as a download, not inline",
  (download.headers()["content-disposition"] ?? "").startsWith("attachment"));
check("it is not cacheable", (download.headers()["cache-control"] ?? "").includes("no-store"));
check("sniffing is disabled", download.headers()["x-content-type-options"] === "nosniff");
const body = await download.text();
check("the bytes come back intact", body === "hello from a test", body.slice(0, 40));

// 3. An outsider cannot, even holding the id.
/*
 * Pick a third person who is genuinely not in this conversation. Using a fixed classmate looks
 * fine until a test run creates a direct chat between them, after which the "refused" check starts
 * passing for the wrong reason — it would be asserting that a member is denied.
 */
const memberIds = new Set(
  (conv.members ?? []).map((m) => (typeof m === "object" && m.userId ? m.userId : m)),
);
const BODIES = ["faith.chebet@example.com", "amos.kiptoo@example.com", "tutor.test@eavi.ac.ke"];
let outsider = null;
for (const email of BODIES) {
  const candidate = await session(email).catch(() => null);
  if (!candidate) continue;
  const me = await (await candidate.request.get(`${BASE}/api/chat/conversations`)).json();
  const mine = (me.rows ?? me.conversations ?? []).some((row) => row.id === conv.id);
  if (!mine) { outsider = candidate; break; }
  await candidate.close();
}
if (!outsider) {
  console.log("  SKIP no non-member available to test the refusal");
  await b.close();
  process.exit(0);
}
const denied = await outsider.request.get(`${BASE}/api/chat/attachments/${attachment.id}`);
check("a non-member is refused", denied.status() === 403, String(denied.status()));

// 4. Anonymous is refused before anything else.
const anon = await b.newContext();
const anonTry = await anon.request.get(`${BASE}/api/chat/attachments/${attachment.id}`);
check("an anonymous visitor is refused", anonTry.status() === 401, String(anonTry.status()));
await anon.close();

// 5. A type that could execute on our origin is refused.
const badForm = new FormData();
badForm.set("conversationId", conv.id);
badForm.set("body", "");
badForm.set("file", new File([new TextEncoder().encode("<script>alert(1)</script>")], "evil.html", { type: "text/html" }));
const badUpload = await student.request.post(`${BASE}/api/chat/attachments`, { multipart: badForm });
check("an HTML file is refused", badUpload.status() === 415, String(badUpload.status()));

// 6. A renamed file is refused: name and type must agree.
const lieForm = new FormData();
lieForm.set("conversationId", conv.id);
lieForm.set("body", "");
lieForm.set("file", new File([new Uint8Array([0x89, 0x50])], "picture.pdf", { type: "image/png" }));
const lieUpload = await student.request.post(`${BASE}/api/chat/attachments`, { multipart: lieForm });
check("a mismatched name is refused", lieUpload.status() === 415, String(lieUpload.status()));

// 7. Path characters in the name cannot escape the prefix.
const pathForm = new FormData();
pathForm.set("conversationId", conv.id);
pathForm.set("body", "");
pathForm.set("file", new File([new TextEncoder().encode("x")], "../../etc/passwd.txt", { type: "text/plain" }));
const pathUpload = await student.request.post(`${BASE}/api/chat/attachments`, { multipart: pathForm });
const pathJson = await pathUpload.json();
check("a path in the name is neutralised",
  pathUpload.ok() && !pathJson.message.attachments[0].fileName.includes("/"),
  pathJson.message?.attachments?.[0]?.fileName ?? pathJson.error);

// 8. A non-member cannot upload either.
const denyForm = new FormData();
denyForm.set("conversationId", conv.id);
denyForm.set("body", "");
denyForm.set("file", new File([new TextEncoder().encode("x")], "n.txt", { type: "text/plain" }));
const denyUpload = await outsider.request.post(`${BASE}/api/chat/attachments`, { multipart: denyForm });
check("a non-member cannot upload", denyUpload.status() === 403, String(denyUpload.status()));

// 9. The file appears in history, so a reopen shows it.
const history = await (await student.request.get(`${BASE}/api/chat/conversations/${conv.id}/messages`)).json();
const found = (history.messages ?? history.rows ?? []).find((m) => m.id === uploaded.message.id);
check("the message is in history", Boolean(found));
check("history carries the attachment", Boolean(found?.attachments?.length));

// 10. The composer renders the attach control.
const page = await student.newPage();
await page.goto(`${BASE}/portal/chat`, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
await page.locator("button").filter({ hasText: /Grace|Njeri|Student|Tutor/ }).first().click().catch(() => {});
await page.waitForTimeout(1500);
const attach = await page.locator('button[aria-label="Attach a document"]').count();
check("the composer offers an attach control", attach > 0);

console.log(failures === 0 ? "\nAll document sharing checks passed." : `\n${failures} check(s) failed.`);
await b.close();
process.exit(failures === 0 ? 0 : 1);
