/**
 * Transactional email delivery for issued application letters.
 *
 * Resend is called only after the letter has been committed. A missing key or a failed
 * request never rolls back the application: the letter remains in the register and the
 * office can give the applicant the same link.
 */

import { site } from "@/lib/content/home";

export type LetterDelivery = {
  ok: boolean;
  skipped?: boolean;
  reason?: string;
  id?: string;
};

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character] ?? character);

function letterUrl(reference: string, token: string) {
  const origin = site.url.replace(/\/$/, "");
  return `${origin}/letter/${encodeURIComponent(reference)}?t=${encodeURIComponent(token)}&format=pdf`;
}

export async function sendAdmissionLetterEmail(input: {
  to: string;
  fullName: string;
  reference: string;
  programName: string;
  campusName: string;
  token: string;
  expiresAt: Date;
}): Promise<LetterDelivery> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM_EMAIL?.trim();
  if (!apiKey || !from) {
    return { ok: false, skipped: true, reason: "Resend is not configured." };
  }

  const url = letterUrl(input.reference, input.token);
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
        subject: `Your application acknowledgement — ${input.reference}`,
        text,
        html,
        tags: [{ name: "type", value: "application-letter" }],
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      return { ok: false, reason: `Resend answered ${response.status}: ${detail.slice(0, 300)}` };
    }
    const body = (await response.json().catch(() => ({}))) as { id?: string };
    return { ok: true, id: body.id };
  } catch (cause) {
    return { ok: false, reason: cause instanceof Error ? cause.message : String(cause) };
  }
}
