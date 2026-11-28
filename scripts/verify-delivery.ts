/**
 * Offline check of the application-letter delivery adapters. It stubs the network and
 * SMTP transport, so no real email or WhatsApp message is sent.
 */

import nodemailer from "nodemailer";

import { sendAdmissionLetterWhatsApp } from "../lib/delivery/whatsapp";

let failures = 0;
const check = (label: string, ok: boolean, detail?: string) => {
  if (ok) console.log(`  ok   ${label}`);
  else { failures += 1; console.error(`  FAIL ${label}${detail ? ` — ${detail}` : ""}`); }
};

type FetchCall = { url: string; init: RequestInit };
const fetchCalls: FetchCall[] = [];
const smtpSends: Record<string, unknown>[] = [];
const originalFetch = globalThis.fetch;
const originalCreateTransport = nodemailer.createTransport;
const originalEnv = {
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL,
  OPENWA_API_KEY: process.env.OPENWA_API_KEY,
  OPENWA_API_URL: process.env.OPENWA_API_URL,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  MAIL_HOST: process.env.MAIL_HOST,
  MAIL_PORT: process.env.MAIL_PORT,
  MAIL_SECURE: process.env.MAIL_SECURE,
  MAIL_USERNAME: process.env.MAIL_USERNAME,
  MAIL_PASSWORD: process.env.MAIL_PASSWORD,
  MAIL_FROM_NAME: process.env.MAIL_FROM_NAME,
  MAIL_FROM_ADDRESS: process.env.MAIL_FROM_ADDRESS,
};

function stubFetch(handler: (call: FetchCall) => Response) {
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const call = { url: String(input), init: init ?? {} };
    fetchCalls.push(call);
    return handler(call);
  }) as typeof fetch;
}

async function main() {
  // The email adapter is imported after the SMTP transport stub is installed.
  nodemailer.createTransport = (() => ({
    sendMail: async (mail: Record<string, unknown>) => {
      smtpSends.push(mail);
      return { messageId: "smtp-1" };
    },
  })) as unknown as typeof nodemailer.createTransport;
  const { sendAdmissionLetterEmail } = await import("../lib/delivery/email");

  console.log("application letter delivery\n");

  process.env.NEXT_PUBLIC_SITE_URL = "https://eavi.test";
  process.env.RESEND_API_KEY = "re_test_key";
  process.env.RESEND_FROM_EMAIL = "EAVI <admissions@eavi.test>";
  stubFetch(() => new Response(JSON.stringify({ id: "email-1" }), { status: 200 }));

  const letter = {
    to: "applicant@eavi.test",
    fullName: "Test Applicant",
    reference: "APP/2026/0001",
    programName: "Diploma in ICT",
    campusName: "Main Campus",
    token: "private-token",
    expiresAt: new Date("2026-12-28T00:00:00Z"),
  };
  const resend = await sendAdmissionLetterEmail(letter);
  const emailCall = fetchCalls[0];
  const emailBody = emailCall ? JSON.parse(String(emailCall.init.body)) : {};
  check("Resend receives the letter email", resend.ok && resend.channel === "resend" && emailCall?.url === "https://api.resend.com/emails");
  check("the email carries the private link", String(emailBody.html).includes("APP%2F2026%2F0001") && String(emailBody.html).includes("private-token"));
  check("the email uses the configured sender", emailBody.from === "EAVI <admissions@eavi.test>" && emailBody.to[0] === "applicant@eavi.test");
  check("the email has an idempotency key", Boolean((emailCall?.init.headers as Record<string, string>)["Idempotency-Key"]));

  delete process.env.RESEND_API_KEY;
  delete process.env.RESEND_FROM_EMAIL;
  process.env.MAIL_HOST = "smtp.test";
  process.env.MAIL_PORT = "587";
  process.env.MAIL_SECURE = "false";
  process.env.MAIL_USERNAME = "smtp-user";
  process.env.MAIL_PASSWORD = "smtp-password";
  process.env.MAIL_FROM_NAME = "East Africa Vision Institute";
  process.env.MAIL_FROM_ADDRESS = "admissions@eavi.test";
  fetchCalls.length = 0;
  stubFetch(() => new Response("unexpected Resend call", { status: 500 }));

  const smtp = await sendAdmissionLetterEmail(letter);
  const sent = smtpSends[0] ?? {};
  check("SMTP is used when Resend has no key", smtp.ok && smtp.channel === "smtp" && fetchCalls.length === 0);
  check("the SMTP letter carries the private link", String(sent.html).includes("private-token") && String(sent.text).includes("APP/2026/0001"));
  check("the SMTP letter uses the configured sender", String(sent.from).includes("admissions@eavi.test") && sent.to === letter.to);

  fetchCalls.length = 0;
  process.env.OPENWA_API_KEY = "owa_test_key";
  process.env.OPENWA_API_URL = "http://gateway.test";
  stubFetch((call) => {
    if (call.url.endsWith("/api/sessions")) {
      return new Response(JSON.stringify([{ id: "session-1", name: "eavi-admissions", status: "ready", phone: "254700000000" }]), { status: 200 });
    }
    return new Response(JSON.stringify({ messageId: "message-1" }), { status: 201 });
  });

  const whatsapp = await sendAdmissionLetterWhatsApp({
    phone: "254700000000",
    fullName: "Test Applicant",
    reference: "APP/2026/0001",
    token: "private-token",
  });
  const sendCall = fetchCalls.find((call) => call.url.includes("/messages/send-text"));
  const sendBody = sendCall ? JSON.parse(String(sendCall.init.body)) : {};
  check("OpenWA sends through the ready session", whatsapp.ok && Boolean(sendCall));
  check("the WhatsApp chat id is the applicant number", sendBody.chatId === "254700000000@c.us");
  check("the WhatsApp message carries the private link", String(sendBody.text).includes("private-token"));
  check("the gateway call is authenticated", (sendCall?.init.headers as Record<string, string>)["X-API-Key"] === "owa_test_key");

  console.log(failures === 0 ? "\nAll delivery checks passed." : `\n${failures} check(s) failed.`);
  if (failures > 0) process.exitCode = 1;
}

main()
  .catch((error) => { console.error(error); process.exitCode = 1; })
  .finally(() => {
    globalThis.fetch = originalFetch;
    nodemailer.createTransport = originalCreateTransport;
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
