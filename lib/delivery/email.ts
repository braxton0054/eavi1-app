/**
 * Transactional email delivery for issued application letters.
 *
 * Resend is preferred when a key is configured; otherwise the portal's existing SMTP
 * settings (the MAIL_* values already used on the server) send the same message. Delivery
 * runs only after the letter has been committed, so a mail outage never loses an
 * application: the letter stays in the register and the office can give the link.
 */

import nodemailer from "nodemailer";

import { site } from "@/lib/content/home";

export type LetterDelivery = {
  ok: boolean;
  skipped?: boolean;
  reason?: string;
  id?: string;
  channel?: "resend" | "smtp";
};

export type AdmissionLetterEmail = {
  to: string;
  fullName: string;
  reference: string;
  programName: string;
  campusName: string;
  token: string;
  expiresAt: Date;
};

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character] ?? character);

function letterContent(input: AdmissionLetterEmail) {
  const origin = site.url.replace(/\/$/, "");
  const url = `${origin}/letter/${encodeURIComponent(input.reference)}?t=${encodeURIComponent(input.token)}&format=pdf`;
  const subject = `Your application acknowledgement — ${input.reference}`;
  const text = [
    `Hello ${input.fullName},`,
    "",
    `Your application to ${input.programName} at ${input.campusName} was received.`,
    `Reference: ${input.reference}`,
    "",
    "Download your acknowledgement letter:",
    url,
    "",
    "This letter confirms that your application was received. It is not an offer of a place.",
    `The link expires on ${input.expiresAt.toUTCString()}. Keep your reference safe.`,
    "",
    site.name,
  ].join("\n");
  const html = `<p>Hello ${escapeHtml(input.fullName)},</p>
<p>Your application to <strong>${escapeHtml(input.programName)}</strong> at ${escapeHtml(input.campusName)} was received.</p>
<p>Reference: <strong>${escapeHtml(input.reference)}</strong></p>
<p><a href="${escapeHtml(url)}">Download your acknowledgement letter</a></p>
<p>This letter confirms that your application was received. It is not an offer of a place.</p>
<p>The link expires on ${escapeHtml(input.expiresAt.toUTCString())}. Keep your reference safe.</p>
<p>${escapeHtml(site.name)}</p>`;
  return { subject, text, html };
}

async function sendViaResend(input: AdmissionLetterEmail): Promise<LetterDelivery> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM_EMAIL?.trim();
  if (!apiKey || !from) return { ok: false, skipped: true, reason: "Resend is not configured." };
  const { subject, text, html } = letterContent(input);
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `eavi-letter-${input.reference}`.slice(0, 256),
      },
      body: JSON.stringify({
        from,
        to: [input.to],
        subject,
        text,
        html,
        tags: [{ name: "type", value: "application-letter" }],
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      return { ok: false, channel: "resend", reason: `Resend answered ${response.status}: ${detail.slice(0, 300)}` };
    }
    const body = (await response.json().catch(() => ({}))) as { id?: string };
    return { ok: true, channel: "resend", id: body.id };
  } catch (cause) {
    return { ok: false, channel: "resend", reason: cause instanceof Error ? cause.message : String(cause) };
  }
}

async function sendViaSmtp(input: AdmissionLetterEmail): Promise<LetterDelivery> {
  const host = process.env.MAIL_HOST?.trim();
  const user = process.env.MAIL_USERNAME?.trim();
  const password = process.env.MAIL_PASSWORD?.trim();
  const fromAddress = process.env.MAIL_FROM_ADDRESS?.trim();
  if (!host || !user || !password || !fromAddress) {
    return { ok: false, skipped: true, reason: "SMTP is not configured." };
  }
  const port = Number(process.env.MAIL_PORT ?? 587);
  const secure = process.env.MAIL_SECURE?.trim().toLowerCase() === "true" || port === 465;
  const fromName = process.env.MAIL_FROM_NAME?.trim() || site.name;
  const { subject, text, html } = letterContent(input);
  try {
    const transport = nodemailer.createTransport({
      host,
      port: Number.isFinite(port) ? port : 587,
      secure,
      auth: { user, pass: password },
      connectionTimeout: 15_000,
      greetingTimeout: 15_000,
      socketTimeout: 15_000,
    });
    const result = await transport.sendMail({
      from: `"${fromName.replace(/["<>]/g, "")}" <${fromAddress}>`,
      to: input.to,
      subject,
      text,
      html,
      headers: { "X-EAVI-Letter": input.reference, "X-EAVI-Channel": "application-letter" },
    });
    return { ok: true, channel: "smtp", id: result.messageId };
  } catch (cause) {
    return { ok: false, channel: "smtp", reason: cause instanceof Error ? cause.message : String(cause) };
  }
}

export async function sendAdmissionLetterEmail(input: AdmissionLetterEmail): Promise<LetterDelivery> {
  const resend = await sendViaResend(input);
  if (!resend.skipped) return resend;
  return sendViaSmtp(input);
}
