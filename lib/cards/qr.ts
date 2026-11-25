import QRCode from "qrcode";

/**
 * The QR code on the back of a card.
 *
 * It encodes a verification *address*, not the student's details. Anything printed on a card
 * can be read by anyone holding it, so the code carries no name, no admission number and no
 * programme — only an unguessable token. A phone resolves that token against the college's
 * own database, which is the only place the answer comes from. A forged code therefore
 * verifies nothing, because there is no record behind it.
 */

/** Where a scanned card is checked. The school's own domain once deployed. */
export function verifyUrl(origin: string, token: string) {
  const base = origin.replace(/\/$/, "");
  return `${base}/verify/${encodeURIComponent(token)}`;
}

/**
 * Renders the code as an SVG group positioned by the artwork.
 *
 * It is produced as vector paths rather than an image so it stays sharp at any print size:
 * a QR that blurs is a QR that will not scan, and this one is what a guard at the gate has
 * to read off a card in poor light.
 */
export async function qrSvgGroup(url: string, size = 132) {
  const svg = await QRCode.toString(url, {
    type: "svg",
    margin: 0,
    errorCorrectionLevel: "M",
    // Fewer, larger squares scan more reliably off a printed surface than fine ones.
    version: 6,
  });

  // The library returns a document whose viewBox is its own module count; it is wrapped in
  // a <g> so it can be dropped straight into the card's `data-slot="qr"` group.
  const inner = svg.replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>[\s\S]*$/, "");

  // Measure the real module count: a version-6 code has 41 modules, not 33. Hard-coding
  // 33 printed the code larger than its reserved square and crowded the label below it.
  const modules = Number(svg.match(/viewBox="0 0 (\d+)/)?.[1] ?? 33);
  return `<g transform="scale(${(size / modules).toFixed(4)})">${inner}</g>`;
}

/**
 * Replaces the artwork's QR placeholder with a real code.
 *
 * The template marks the slot and says its contents are replaced at render time. Filling it
 * here rather than editing the artwork keeps the design in the SVG and the data out of it.
 */
export async function fillQrSlot(svg: string, url: string) {
  const match = svg.match(/<g[^>]*data-slot="qr"[^>]*>([\s\S]*?)<\/g>/);
  if (!match) return svg;

  const group = await qrSvgGroup(url);
  const openTag = match[0].slice(0, match[0].indexOf(">") + 1);

  return svg.replace(match[0], `${openTag}${group}</g>`);
}
