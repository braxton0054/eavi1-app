import "dotenv/config";

import { io } from "socket.io-client";
import { chromium } from "playwright-core";
import { execFileSync } from "node:child_process";

import { prisma } from "../lib/prisma";
import { createSession, hashPassword, resolveSession, SESSION_COOKIE } from "../lib/auth";
import { checkRateLimit, clearRateLimit } from "../lib/security/rate-limit";
import { issueApprovedLetter } from "../lib/admissions/issue";
import { revokeUserAccess } from "../lib/security/revocation";

const base = process.env.VERIFY_BASE ?? "http://localhost:3111";
let failures = 0;

function check(name: string, pass: boolean, detail = "") {
  if (!pass) failures += 1;
  console.log(`  ${pass ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
}

async function request(path: string, options: RequestInit = {}) {
  return fetch(`${base}${path}`, { redirect: "manual", ...options });
}

async function socketRefused(cookie: string): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = io(base, {
      transports: ["websocket"],
      reconnection: false,
      extraHeaders: { Cookie: cookie },
    });
    const finish = (result: boolean) => {
      socket.disconnect();
      resolve(result);
    };
    socket.on("connect", () => finish(false));
    socket.on("connect_error", () => finish(true));
    setTimeout(() => finish(false), 5_000);
  });
}

async function socketRevokedOnDisable(cookie: string, userId: string): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = io(base, {
      transports: ["websocket"],
      reconnection: false,
      extraHeaders: { Cookie: cookie },
    });
    socket.on("connect", async () => {
      await revokeUserAccess(userId, "DISABLED");
      socket.emit("chat:typing", { conversationId: "security-test", typing: true });
    });
    socket.on("disconnect", () => resolve(true));
    socket.on("connect_error", () => resolve(false));
    setTimeout(() => {
      socket.disconnect();
      resolve(false);
    }, 5_000);
  });
}

async function main() {
  console.log("security regression checks\n");
  const program = await prisma.program.findFirst({ select: { id: true } });
  const applyProgram = await prisma.program.findFirst({
    where: { archivedAt: null, campuses: { some: { takesApplicants: true } } },
    select: { id: true },
  });
  const campus = await prisma.campus.findFirst({ select: { id: true } });
  const period = await prisma.academicPeriod.findFirst({ select: { id: true } });
  if (!program || !applyProgram || !campus || !period) throw new Error("Seed data missing");

  const unique = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const staffEmail = `staff-${unique}@eavi.test`;

  console.log("A1 staff self-registration");
  const staffRegistration = await request("/api/auth/register", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      fullName: "Unauthorized Staff",
      email: staffEmail,
      phone: "0712000000",
      password: "AttackerChosenPassword",
      confirm: "AttackerChosenPassword",
      role: "SUPERADMIN",
      campusId: campus.id,
    }),
  });
  check("a forged staff role is rejected", staffRegistration.status === 403);
  check("the forged account is not created", (await prisma.user.count({ where: { email: staffEmail } })) === 0);

  console.log("A2/A3 public application privacy and review");
  const application = await prisma.application.create({
    data: {
      reference: `APP/SEC/${unique}`,
      fullName: "Private Applicant",
      phone: `+2547${String(Date.now()).slice(-8)}`,
      email: `private-${unique}@eavi.test`,
      gender: "MALE",
      grade: "A",
      programId: program.id,
      campusId: campus.id,
    },
    select: { id: true, reference: true, phone: true },
  });
  try {
    const lookup = await request("/api/applications/lookup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ answer: application.phone }),
    });
    const lookupBody = await lookup.text();
    check("lookup returns no applicant PII", !lookupBody.includes("Private Applicant") && !lookupBody.includes(application.reference));
    check("lookup never returns a letter capability", !lookupBody.includes("letterUrl") && !lookupBody.includes("verifyToken"));

    const update = await request("/api/applications/update", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reference: application.reference, verifyToken: "anything", programId: program.id }),
    });
    check("public programme changes are disabled", update.status === 410);

    const unissued = await prisma.$transaction((tx) =>
      issueApprovedLetter(tx, application.id, { id: "test", email: "test@eavi.test" }),
    );
    check("an unreviewed public application cannot receive an official letter", unissued === null);

    await prisma.application.update({
      where: { id: application.id },
      data: {
        status: "APPROVED",
        contactVerifiedAt: new Date(),
        contactVerificationMethod: "COUNTER",
      },
    });
    const issued = await prisma.$transaction((tx) =>
      issueApprovedLetter(tx, application.id, { id: "test", email: "test@eavi.test" }),
    );
    check("office approval plus contact verification issues the letter", Boolean(issued));
    const row = await prisma.offerLetter.findUnique({ where: { applicationId: application.id } });
    check("the issuer is recorded", row?.issuedById === "test" && row?.issuedByEmail === "test@eavi.test");
  } finally {
    await prisma.application.delete({ where: { id: application.id } });
  }

  const publicSubmission = await request("/api/applications", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      fullName: "Public Submission Applicant",
      phone: `+2547${String(Date.now()).slice(-8)}`,
      email: `public-${unique}@eavi.test`,
      gender: "MALE",
      grade: "A",
      programId: applyProgram.id,
      website: "",
    }),
  });
  const publicBody = await publicSubmission.json();
  check("the public form accepts a valid application", publicSubmission.status === 201, `${publicSubmission.status} ${JSON.stringify(publicBody)}`);
  const publicReference = typeof publicBody.reference === "string" ? publicBody.reference : null;
  const publicRow = publicReference ? await prisma.application.findUnique({
    where: { reference: publicReference },
    select: { id: true, status: true, offerLetter: { select: { id: true } } },
  }) : null;
  check("a valid public submission is accepted automatically", publicRow?.status === "APPROVED");
  check("a valid public submission receives an acknowledgement letter", publicRow?.offerLetter !== null);
  if (publicRow) await prisma.application.delete({ where: { id: publicRow.id } });

  console.log("A4/A6 session status and temporary passwords");
  const email = `temp-${unique}@eavi.test`;
  const password = "TemporaryPassword123!";
  const user = await prisma.user.create({
    data: {
      email,
      fullName: "Temporary Password Student",
      phone: `+2547${String(Date.now()).slice(-8)}`,
      passwordHash: await hashPassword(password),
      role: "STUDENT",
      status: "ACTIVE",
      mustChangePassword: true,
      campusId: campus.id,
    },
    select: { id: true },
  });
  const profile = await prisma.studentProfile.create({
    data: { userId: user.id, admissionNo: `SEC/${unique}`, campusId: campus.id },
    select: { id: true },
  });
  await prisma.enrollment.create({
    data: {
      studentId: profile.id,
      programId: program.id,
      periodId: period.id,
      campusId: campus.id,
      yearIndex: 1,
      semesterNo: 1,
      status: "ACTIVE",
    },
  });
  const token = await createSession(user.id);
  const cookie = `${SESSION_COOKIE}=${token}`;
  try {
    await clearRateLimit("login-account", email);
    await clearRateLimit("login-ip", "untrusted");
    await clearRateLimit("login-global", "all");
    const login = await request("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const loginBody = await login.json();
    check("password login reports the forced-password state", login.status === 200 && loginBody.mustChangePassword === true);

    const native = await request("/api/auth/login/form", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ email, password, next: "/student/id" }),
    });
    check("native login redirects to password setup", native.status === 303 && Boolean(native.headers.get("location")?.endsWith("/set-password")));

    const portal = await request("/student/id", { headers: { Cookie: cookie }, redirect: "follow" });
    const portalBody = await portal.text();
    check("a flagged session cannot enter the portal directly", portalBody.includes("/set-password") || portalBody.includes("Set a password"), portal.url);
    const notifications = await request("/api/notifications", { headers: { Cookie: cookie } });
    check("a flagged session cannot use notification APIs", notifications.status === 401);
    check("a flagged session cannot open a chat socket", await socketRefused(cookie));

    const otherToken = await createSession(user.id);
    const browser = await chromium.launch({ executablePath: "/usr/bin/chromium", args: ["--no-sandbox"] });
    try {
      const context = await browser.newContext();
      await context.addCookies([{ name: SESSION_COOKIE, value: token, url: base }]);
      const page = await context.newPage();
      await page.goto(`${base}/set-password`, { waitUntil: "networkidle" });
      await page.locator("#password").fill("ChosenPassword123!");
      await page.locator("#confirm").fill("ChosenPassword123!");
      await page.getByRole("button", { name: "Save password and continue" }).click();
      await page.waitForURL((url) => !url.pathname.includes("/set-password"), { timeout: 30_000 });
    } finally {
      await browser.close();
    }
    check("password setup clears the forced-password flag", (await prisma.user.findUnique({ where: { id: user.id }, select: { mustChangePassword: true } }))?.mustChangePassword === false);
    check("password setup revokes other temporary-password sessions", (await resolveSession(otherToken)) === null);

    const disabledToken = await createSession(user.id);
    check("a live chat socket is revoked when the account is disabled", await socketRevokedOnDisable(cookie, user.id));
    check("session resolution rejects a disabled account", (await resolveSession(token)) === null);
    check("all old sessions are revoked", (await resolveSession(disabledToken)) === null);
    const disabledPage = await request("/student/id", { headers: { Cookie: cookie }, redirect: "follow" });
    const disabledBody = await disabledPage.text();
    check("a disabled session is sent back to sign in", disabledBody.includes("/login") || disabledBody.includes("Sign in"), disabledPage.url);
  } finally {
    await prisma.user.deleteMany({ where: { id: user.id } });
  }

  console.log("A5 shared Redis limits");
  const scope = `security-test-${unique}`;
  const identifier = "same-account";
  await clearRateLimit(scope, identifier);
  const results = await Promise.all(
    Array.from({ length: 10 }, () => checkRateLimit({ scope, identifier, limit: 3, windowMs: 60_000 })),
  );
  check("concurrent requests cannot exceed the atomic budget", results.filter((result) => result.allowed).length === 3);
  await clearRateLimit(scope, identifier);

  const sprayEmail = `spray-${unique}@eavi.test`;
  let blocked = false;
  for (let attempt = 0; attempt < 9; attempt += 1) {
    const response = await request(attempt % 2 === 0 ? "/api/auth/login" : "/api/auth/login/form", {
      method: "POST",
      headers: {
        "content-type": attempt % 2 === 0 ? "application/json" : "application/x-www-form-urlencoded",
        "x-forwarded-for": `198.51.100.${attempt + 1}`,
      },
      body: attempt % 2 === 0
        ? JSON.stringify({ email: sprayEmail, password: "wrong-password" })
        : new URLSearchParams({ email: sprayEmail, password: "wrong-password" }),
    });
    if (response.status === 429) {
      blocked = true;
      break;
    }
  }
  check("JSON and native login share one account limit despite spoofed IPs", blocked);

  const outageProbe = execFileSync(
    process.execPath,
    [
      "--import",
      "tsx",
      "--input-type=module",
      "-e",
      "import { checkRateLimit } from './lib/security/rate-limit.ts'; try { await checkRateLimit({ scope: 'outage-test', identifier: 'x', limit: 1, windowMs: 1000 }); console.log('allowed'); } catch (error) { console.log(error.name); } finally { process.exit(0); }",
    ],
    {
      cwd: process.cwd(),
      env: { ...process.env, REDIS_URL: "redis://127.0.0.1:6399" },
      encoding: "utf8",
      timeout: 10_000,
    },
  );
  check("a Redis outage fails closed instead of allowing unlimited attempts", outageProbe.includes("RateLimitUnavailableError"));

  console.log(`\n${failures === 0 ? "All security checks passed." : `${failures} security check(s) failed.`}`);
  await prisma.$disconnect();
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
