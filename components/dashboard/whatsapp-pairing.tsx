"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { AlertCircleIcon, CheckCircle2Icon, RefreshCwIcon } from "lucide-react";

import { StatusChip, type ChipTone } from "@/components/dashboard/status-chip";
import type { PairingState } from "@/lib/delivery/whatsapp";

const statusLabels: Record<string, string> = {
  ready: "Linked and sending",
  qr_ready: "Ready to scan",
  initializing: "Starting WhatsApp",
  authenticating: "Completing the link",
  disconnected: "Disconnected",
  failed: "Link failed",
  action_required: "Needs attention on the phone",
  unconfigured: "Not configured",
  unavailable: "Gateway unavailable",
};

const statusTones: Record<string, ChipTone> = {
  ready: "success",
  qr_ready: "warning",
  initializing: "info",
  authenticating: "info",
  disconnected: "warning",
  failed: "danger",
  action_required: "warning",
  unconfigured: "warning",
  unavailable: "danger",
};

export function WhatsAppPairing({ initial }: { initial: PairingState }) {
  const [state, setState] = useState(initial);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/whatsapp/state", { cache: "no-store" });
      if (!response.ok) throw new Error("The gateway state could not be read.");
      setState((await response.json()) as PairingState);
      setFailed(false);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (state.status === "ready") return;
    const timer = window.setInterval(() => void refresh(), 5000);
    return () => window.clearInterval(timer);
  }, [refresh, state.status]);

  const ready = state.status === "ready";

  return (
    <div className="space-y-4 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <StatusChip tone={statusTones[state.status] ?? "neutral"}>
          {statusLabels[state.status] ?? state.status}
        </StatusChip>
        {state.phone ? (
          <span className="text-sm tabular-nums text-eavi-muted-text">Linked phone: {state.phone}</span>
        ) : null}
      </div>

      <p aria-live="polite" className="text-sm text-eavi-muted-text">
        Session <span className="font-medium text-eavi-text">{state.sessionName}</span>. The code changes
        every few seconds. Keep this screen open while you scan it with WhatsApp.
      </p>

      {state.qrCode ? (
        <div className="flex justify-center rounded-xl border border-eavi-border bg-eavi-card p-4">
          <Image
            src={state.qrCode}
            alt="WhatsApp pairing QR code for the EAVI admissions number"
            width={240}
            height={240}
            unoptimized
            className="size-60"
            priority
          />
        </div>
      ) : null}

      {ready ? (
        <p className="flex items-center gap-2 rounded-lg bg-eavi-success-soft p-3 text-sm text-eavi-secondary-text">
          <CheckCircle2Icon aria-hidden className="size-5 shrink-0" />
          Application letters will also be sent over WhatsApp.
        </p>
      ) : null}

      {!state.configured ? (
        <p className="flex items-start gap-2 rounded-lg bg-eavi-warn-soft p-3 text-sm text-eavi-warn-text">
          <AlertCircleIcon aria-hidden className="mt-0.5 size-5 shrink-0" />
          {state.reason ?? "OPENWA_API_KEY is not set on the server."}
        </p>
      ) : null}

      {failed ? (
        <p role="alert" className="rounded-lg bg-eavi-danger-soft p-3 text-sm text-eavi-destructive">
          The gateway state could not be refreshed. Check that the OpenWA container is running.
        </p>
      ) : null}

      {state.reason && !state.configured ? null : state.reason ? (
        <p className="text-sm text-eavi-muted-text">{state.reason}</p>
      ) : null}

      <button
        type="button"
        onClick={() => void refresh()}
        disabled={loading}
        aria-busy={loading}
        className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-eavi-fill px-4 text-sm font-medium text-eavi-on-fill transition-colors hover:bg-eavi-fill-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-eavi-primary-text active:translate-y-px disabled:cursor-wait disabled:opacity-60"
      >
        <RefreshCwIcon aria-hidden className={loading ? "size-4 animate-spin" : "size-4"} />
        {loading ? "Checking the gateway" : "Refresh pairing code"}
      </button>

      <p className="text-xs text-eavi-muted-text">
        On the phone, open WhatsApp → Settings → Linked devices → Link a device, then scan the code.
      </p>
    </div>
  );
}
