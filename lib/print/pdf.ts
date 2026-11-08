import { chromium } from "playwright-core";

import { pages } from "@/lib/content/dashboard";
import { formatDate } from "@/lib/format";

/**
 * Renders a page as an A4 PDF using a real browser.
 *
 * The browser's own "print" dialogue cannot be trusted to produce an archive copy: it adds a
 * URL, a timestamp and its own page numbers in the margin, and the margins differ per user.
 * Driving Chromium here means every PDF the institute keeps looks the same — true A4, our own
 * running header and footer, and page numbers that only we control.
 *
 * `preferCSSPageSize` defers the paper size to the `@page` rule, so the layout stays in
 * millimetres rather than being re-derived from a format string.
 */

/** The chrome binary, looked up in the usual places so a deploy can point at its own. */
const CANDIDATES = [
  process.env.CHROMIUM_PATH,
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
].filter((path): path is string => Boolean(path));

export type PdfSubject = { fullName: string; admissionNo: string };

/**
 * The running header and footer.
 *
 * Kept to one line each and 8pt grey, so they read as a document frame rather than as content
 * competing with the record itself.
 */
function headerTemplate(subject: PdfSubject): string {
  return `
    <div style="width:100%;padding:0 14mm;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;font-size:8pt;color:#666;display:flex;justify-content:space-between;align-items:center;">
      <span>East Africa Vision Institute</span>
      <span>${escapeHtml(subject.fullName)} · ${escapeHtml(subject.admissionNo)}</span>
    </div>`;
}

function footerTemplate(printedOn: Date): string {
  return `
    <div style="width:100%;padding:0 14mm;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;font-size:8pt;color:#666;display:flex;justify-content:space-between;align-items:center;">
      <span>${escapeHtml(pages.students.profile.print.confidential)}</span>
      <span>${escapeHtml(pages.students.profile.print.printedOn(formatDate(printedOn)))}</span>
      <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
    </div>`;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] ?? char,
  );
}

/**
 * Prints `url` to a PDF buffer.
 *
 * The caller must already hold a session cookie for `url`, because the page behind it is
 * scoped to a campus: the browser here is a real client, not a privileged second door.
 */
export async function renderPdf(options: {
  url: string;
  cookie?: { name: string; value: string };
  subject: PdfSubject;
}): Promise<Buffer> {
  const executablePath = CANDIDATES.find(Boolean);
  if (!executablePath) {
    throw new Error(
      "No Chromium binary was found. Set CHROMIUM_PATH to the browser used for printing.",
    );
  }

  /*
   * Hard limits, because this runs on a small VPS: an unresponsive page would otherwise hold
   * the request open until the proxy gave up, and each concurrent print is a whole browser
   * process. A record is one short document, so these ceilings are generous for the job and
   * strict enough that a stuck render cannot pile up.
   */
  const browser = await chromium.launch({
    executablePath,
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
    timeout: 20_000,
  });

  try {
    const context = await browser.newContext({
      // The print stylesheet is the document; the viewport only decides the layout width,
      // and A4 at 96dpi is 794px.
      viewport: { width: 794, height: 1123 },
    });

    if (options.cookie) {
      const { hostname } = new URL(options.url);
      await context.addCookies([
        {
          name: options.cookie.name,
          value: options.cookie.value,
          domain: hostname,
          path: "/",
          httpOnly: true,
          sameSite: "Lax",
        },
      ]);
    }

    const page = await context.newPage();
    page.setDefaultTimeout(20_000);
    await page.goto(options.url, { waitUntil: "networkidle", timeout: 20_000 });
    // The print-only document becomes the page; everything else is hidden by the stylesheet.
    await page.emulateMedia({ media: "print" });

    const pdf = await page.pdf({
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: true,
      headerTemplate: headerTemplate(options.subject),
      footerTemplate: footerTemplate(new Date()),
    });

    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}

/**
 * Renders a self-contained HTML string to A4.
 *
 * Deliberately separate from `renderPdf`: a letter is not a portal page. There is no session to
 * carry, no running header or footer (the college's own letterhead is the frame), and the markup
 * is passed in directly rather than fetched, so the letter cannot depend on the app being
 * reachable — which matters in a container where the print call and the web server may not agree
 * on an address.
 *
 * Images in the markup must already be `data:` URIs. The document is set with `setContent`, which
 * gives it an opaque origin, so a relative `/letterhead.png` cannot resolve — and fetching from
 * our own server would make the letter depend on the web server being reachable from inside the
 * print process, which is exactly the kind of thing that works locally and fails in a container.
 */
export async function renderHtmlPdf(html: string): Promise<Buffer> {
  const executablePath = CANDIDATES.find(Boolean);
  if (!executablePath) {
    throw new Error(
      "No Chromium binary was found. Set CHROMIUM_PATH to the browser used for printing.",
    );
  }

  const browser = await chromium.launch({
    executablePath,
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
    timeout: 20_000,
  });

  try {
    const context = await browser.newContext({ viewport: { width: 794, height: 1123 } });
    const page = await context.newPage();
    page.setDefaultTimeout(20_000);

    await page.setContent(html, { waitUntil: "load" });
    await page.emulateMedia({ media: "print" });

    /*
     * Images are awaited explicitly: `load` fires for the document but not necessarily for
     * every <img>, and a letter printed before the letterhead decodes comes out blank at the
     * top — the one part of the page that must never be missing.
     */
    await page.waitForFunction(
      () =>
        Array.from(document.images).every((img) => img.complete && img.naturalWidth > 0),
      undefined,
      { timeout: 10_000 },
    ).catch(() => undefined);

    const pdf = await page.pdf({
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: false,
    });

    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
