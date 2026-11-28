/**
 * WhatsApp delivery through the OpenWA gateway that runs inside this application's
 * Docker stack. The gateway's own dashboard is disabled; pairing and status are read
 * through its REST API and surfaced in our super-admin screen.
 *
 * Official project: github.com/rmyndharis/OpenWA. Its API and bundled UI share one
 * internal port (2785); our Compose file publishes that on a unique host port (2786).
 */

import { site } from "@/lib/content/home";

type OpenWaSession = {
  id: string;
  name: string;
  status: string;
  phone?: string | null;
  lastError?: string | null;
};

export type PairingState = {
  configured: boolean;
  sessionId: string | null;
  sessionName: string;
  status: string;
  phone: string | null;
  qrCode: string | null;
  reason: string | null;
};

export type LetterDelivery = {
  ok: boolean;
  skipped?: boolean;
  reason?: string;
  messageId?: string;
};

const sessionName = () => (process.env.OPENWA_SESSION_NAME?.trim() || "eavi-admissions").slice(0, 50);
const apiUrl = () => (process.env.OPENWA_API_URL?.trim() || "http://openwa:2785").replace(/\/$/, "");

export function whatsappConfigured() {
  return Boolean(process.env.OPENWA_API_KEY?.trim());
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const key = process.env.OPENWA_API_KEY?.trim();
  if (!key) throw new Error("OpenWA is not configured.");
  const response = await fetch(`${apiUrl()}${path}`, {
    ...init,
    headers: {
      "X-API-Key": key,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
    signal: AbortSignal.timeout(15_000),
    cache: "no-store",
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`OpenWA answered ${response.status}: ${detail.slice(0, 300)}`);
  }
  return (await response.json().catch(() => ({}))) as T;
}

function asSessions(value: unknown): OpenWaSession[] {
  if (Array.isArray(value)) return value as OpenWaSession[];
  if (value && typeof value === "object" && Array.isArray((value as { data?: unknown }).data)) {
    return (value as { data: OpenWaSession[] }).data;
  }
  return [];
}

async function findOrCreateSession(): Promise<OpenWaSession> {
  const name = sessionName();
  const listed = await request<unknown>("/api/sessions");
  const existing = asSessions(listed).find((row) => row.name === name);
  if (existing) return existing;
  try {
    return await request<OpenWaSession>("/api/sessions", {
      method: "POST",
      body: JSON.stringify({ name }),
    });
  } catch (cause) {
    // Two admins opening the screen together can both create. The loser reads the winner.
    if (cause instanceof Error && cause.message.includes("409")) {
      const again = asSessions(await request<unknown>("/api/sessions"));
      const found = again.find((row) => row.name === name);
      if (found) return found;
    }
    throw cause;
  }
}

/** Status and, when needed, a fresh QR data URL for the super-admin pairing screen. */
export async function whatsappPairingState(): Promise<PairingState> {
  if (!whatsappConfigured()) {
    return {
      configured: false,
      sessionId: null,
      sessionName: sessionName(),
      status: "unconfigured",
      phone: null,
      qrCode: null,
      reason: "OPENWA_API_KEY is not set.",
    };
  }
  try {
    const session = await findOrCreateSession();
    if (session.status !== "ready" && ["created", "disconnected", "failed"].includes(session.status)) {
      try {
        await request(`/api/sessions/${encodeURIComponent(session.id)}/start`, { method: "POST" });
      } catch {
        // Starting an already-started session answers 400; the QR read below is authoritative.
      }
    }
    if (session.status === "ready") {
      return {
        configured: true,
        sessionId: session.id,
        sessionName: session.name,
        status: "ready",
        phone: session.phone ?? null,
        qrCode: null,
        reason: null,
      };
    }
    try {
      const qr = await request<{ qrCode?: string; status?: string }>(
        `/api/sessions/${encodeURIComponent(session.id)}/qr`,
      );
      return {
        configured: true,
        sessionId: session.id,
        sessionName: session.name,
        status: qr.status ?? session.status,
        phone: session.phone ?? null,
        qrCode: qr.qrCode ?? null,
        reason: qr.qrCode ? null : "Waiting for WhatsApp to generate a QR code.",
      };
    } catch (cause) {
      return {
        configured: true,
        sessionId: session.id,
        sessionName: session.name,
        status: session.status,
        phone: session.phone ?? null,
        qrCode: null,
        reason: cause instanceof Error ? cause.message : String(cause),
      };
    }
  } catch (cause) {
    return {
      configured: true,
      sessionId: null,
      sessionName: sessionName(),
      status: "unavailable",
      phone: null,
      qrCode: null,
      reason: cause instanceof Error ? cause.message : String(cause),
    };
  }
}

export async function sendAdmissionLetterWhatsApp(input: {
  phone: string;
  fullName: string;
  reference: string;
  token: string;
}): Promise<LetterDelivery> {
  if (!whatsappConfigured()) {
    return { ok: false, skipped: true, reason: "OpenWA is not configured." };
  }
  try {
    const state = await whatsappPairingState();
    if (state.status !== "ready" || !state.sessionId) {
      return { ok: false, skipped: true, reason: `WhatsApp is ${state.status}; letter link not sent.` };
    }
    const origin = site.url.replace(/\/$/, "");
    const url = `${origin}/letter/${encodeURIComponent(input.reference)}?t=${encodeURIComponent(input.token)}&format=pdf`;
    const digits = input.phone.replace(/\D/g, "");
    if (!digits) return { ok: false, reason: "No WhatsApp number on the application." };
    const text = [
      `Hello ${input.fullName},`,
      `Your application reference is ${input.reference}.`,
      `Download your acknowledgement letter: ${url}`,
      "This confirms we received your application. It is not an offer of a place.",
      site.name,
    ].join("\n");
    const result = await request<{ messageId?: string }>(
      `/api/sessions/${encodeURIComponent(state.sessionId)}/messages/send-text`,
      { method: "POST", body: JSON.stringify({ chatId: `${digits}@c.us`, text }) },
    );
    return { ok: true, messageId: result.messageId };
  } catch (cause) {
    return { ok: false, reason: cause instanceof Error ? cause.message : String(cause) };
  }
}
