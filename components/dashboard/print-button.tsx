"use client";

import { DownloadIcon, Loader2Icon, PrinterIcon } from "lucide-react";
import { useState } from "react";

import { common, pages } from "@/lib/content/dashboard";

/**
 * Download the record as a PDF, or print it from the browser.
 *
 * The PDF is built on the server, which is the only way to get the same document every time:
 * the browser's own print dialogue leaves its URL, date and page numbers in the margin and
 * uses whatever margins the user last chose. The secondary action hands the same page to that
 * dialogue for anyone who wants to print directly, and the stylesheet makes it look right —
 * the only thing the user has to do is untick "Headers and footers".
 */
export function PrintButton({
  label = pages.students.profile.print.downloadLabel,
  pdfHref,
}: {
  label?: string;
  /** Server route that returns the PDF. Without it only the browser dialogue is offered. */
  pdfHref?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function download() {
    if (!pdfHref) {
      window.print();
      return;
    }
    setBusy(true);
    setFailed(false);
    try {
      const response = await fetch(pdfHref);
      if (!response.ok) throw new Error(String(response.status));
      // A blob URL keeps the PDF in the tab it was asked from, instead of leaving a storage
      // URL on screen for the admin to copy.
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="no-print flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={download}
        disabled={busy}
        className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-eavi-primary-text px-3 text-sm font-medium text-eavi-bg hover:opacity-90 disabled:opacity-60"
      >
        {busy ? (
          <Loader2Icon aria-hidden className="size-4 animate-spin" />
        ) : (
          <DownloadIcon aria-hidden className="size-4" />
        )}
        {busy ? common.loading : label}
      </button>

      <button
        type="button"
        onClick={() => window.print()}
        className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-eavi-border px-3 text-sm font-medium text-eavi-primary-text hover:bg-eavi-muted"
        title={pages.students.profile.print.browserHint}
      >
        <PrinterIcon aria-hidden className="size-4" />
        {pages.students.profile.print.browserButton}
      </button>

      {failed ? (
        <p role="alert" className="text-sm text-eavi-destructive">
          {pages.students.profile.print.failed}
        </p>
      ) : null}
    </div>
  );
}
