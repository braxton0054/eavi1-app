/**
 * Offline check of the two application-letter delivery adapters. It stubs fetch, so no
 * real Resend email or WhatsApp message is sent.
 */

import { sendAdmissionLetterEmail } from "../lib/delivery/email";
import { sendAdmissionLetterWhatsApp } from "../lib/delivery/whatsapp";

let failures = 0;
const check = (label: string, ok: boolean, detail?: string) => {
  if (ok) console.log(`  ok   ${label}`);
  else { failures += 1; console.error(`  FAIL ${label}${detail ? ` — ${detail}` : ""}`); }
};

type FetchCall = { url: string; init: RequestInit };
const calls: FetchCall[] = [];
const originalFetch = globalThis.fetch;
const originalEnv = {
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL,
  OPENWA_API_KEY: process.env.OPENWA_API_KEY,
  OPENWA_API_URL: process.env.OPENWA_API_URL,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
};

function stubFetch(handler: (call: FetchCall) => Response) {
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const call = { url: String(input), init: init ?? {} };
    calls.push(call);
    return handler(call);
  }) as typeof fetch;
}

async function main() {
  console.log("application letter delivery\n");

  process.env.NEXT_PUBLIC_SITE_URL = "https://eavi.test";
  process.env.RESEND_API_KEY = "re_test_key";
  process.env.RESEND_FROM_EMAIL = "EAVI <admissions@eavi.test>";
  stubFetch(() => new Response(JSON.stringify({ id: "email-1" }), { status: 200 }));

  const email = await sendAdmissionLetterEmail({
    to: "applicant@eavi.test",
    fullName: "Test Applicant",
    reference: "APP/2026/0001",
    programName: "Diploma in ICT",
    campusName: "Main Campus",
    token: "private-token",
    expiresAt: new Date("2026-12-28T00:00:00Z"),
  });
  const emailCall = calls[0];
  const emailBody = emailCall ? JSON.parse(String(emailCall.init.body)) : {};
  check("Resend receives the letter email", email.ok && emailCall?.url === "https://api.resend.com/emails");
  check("the email carries the private link", String(emailBody.html).includes("APP%2F2026%2F0001") && String(emailBody.html).includes("private-token"));
  check("the email uses the configured sender", emailBody.from === "EAVI <admissions@eavi.test>" && emailBody.to[0] === "applicant@eavi.test");
  check("the email has an idempotency key", Boolean((emailCall?.init.headers as Record<string, string>)["Idempotency-Key"]));

  calls.length = 0;
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
  const sendCall = calls.find((call) => call.url.includes("/messages/send-text"));
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
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
