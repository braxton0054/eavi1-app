import { readFile } from "node:fs/promises";
import path from "node:path";

import { renderToStaticMarkup } from "react-dom/server";

import { LETTER_CSS, OfferLetter, type LetterView } from "@/components/admissions/offer-letter";

/**
 * The letter as one self-contained HTML document.
 *
 * The three images are inlined as `data:` URIs. Chromium sets the document with `setContent`,
 * which gives it an opaque origin, so `/letterhead.png` cannot resolve — and pointing at our own
 * server would make printing depend on the web server being reachable from inside the print
 * process. Inlining removes both problems and makes the document reproducible byte for byte.
 *
 * Kept in a `.tsx` file so the assembler stays plain TypeScript: JSX in a `.ts` module does not
 * compile, and the assembler has no business knowing about markup.
 */

/** Files on disk, inlined once per process: they never change while the server is running. */
const cache = new Map<string, string>();

async function dataUri(name: string): Promise<string | null> {
  const cached = cache.get(name);
  if (cached) return cached;

  try {
    const bytes = await readFile(path.join(process.cwd(), "public", name));
    const mime = name.endsWith(".png") ? "image/png" : "application/octet-stream";
    const uri = `data:${mime};base64,${bytes.toString("base64")}`;
    cache.set(name, uri);
    return uri;
  } catch {
    // A missing asset must not stop the letter: the text still has to go out.
    return null;
  }
}

export async function letterHtml(view: LetterView): Promise<string> {
  const [header, signature, stamp] = await Promise.all([
    dataUri("letterhead.png"),
    dataUri("letter-signature.png"),
    dataUri("letter-stamp.png"),
  ]);

  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>Offer letter ${escapeAttr(view.reference)}</title>
<style>${LETTER_CSS}</style></head>
<body>${renderToStaticMarkup(
    <OfferLetter view={view} assets={{ header, signature, stamp }} />,
  )}</body>
</html>`;
}

function escapeAttr(value: string): string {
  return value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}
