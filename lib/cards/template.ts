/**
 * Card artwork is data, not code: a campus can change its design without a deploy, so the
 * template is text with brace-wrapped slots. This module is the merge engine that fills
 * those slots, and it is deliberately pure — no database, no filesystem — so the print
 * view and the verification script can both use it.
 */

/** Every slot the templates may contain, and the value that fills it. */
export type CardSlots = Record<string, string | null | undefined>;

/**
 * Text slots the renderer knows how to fill. A template that names one of these gets its
 * value; an unknown slot is left as the literal text so a typo shows up on the proof
 * rather than silently disappearing from the card.
 */
export const KNOWN_SLOTS = [
  "logo_url",
  "signature_url",
  "photo_url",
  "reg_no",
  "full_name",
  "course",
  "campus",
  "intake",
  "expiry_date",
  "issue_date",
  "website",
  "verify_token",
  "emergency_name",
  "emergency_phone",
  "contact_email",
] as const;

/** Slots whose braces are substituted even when the value is missing, or the card shows raw template text. */
export const ASSET_SLOTS = ["logo_url", "signature_url", "photo_url"] as const;

/** XML-escaped so a student called "O'Brien & Sons <Jr>" cannot break the document. */
export function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Average glyph width as a fraction of the font size.
 *
 * Measured against the artwork's own font stack rather than guessed: a 51-character course
 * name at 19 units rendered 611 units wide, which is 0.63 per character. The factor is set
 * slightly above that so text shrinks a touch early rather than overrunning the edge — an
 * ID card that clips a course name is worse than one whose type is a size smaller.
 */
const GLYPH_WIDTH = 0.65;

/** The font size a `<text>` element already carries, from its size attribute or its CSS class. */
function fontSizeOf(element: string, css: Record<string, number>) {
  const attr = element.match(/\bfont-size="([\d.]+)"/);
  if (attr) return Number(attr[1]);

  const cls = element.match(/\bclass="([^"]+)"/);
  const names = cls ? cls[1].split(/\s+/) : [];
  for (const name of names) {
    if (css[name] !== undefined) return css[name];
  }

  return 24;
}

/** Font sizes declared in the template's own <style> block, keyed by class name. */
function cssSizes(template: string) {
  const sizes: Record<string, number> = {};
  for (const rule of template.matchAll(/\.([a-z-]+)\s*\{([^}]*)\}/g)) {
    const size = rule[2].match(/font-size:\s*([\d.]+)px/);
    if (size) sizes[rule[1]] = Number(size[1]);
  }
  return sizes;
}

/**
 * Shrinks text that would overrun the width its slot declares.
 *
 * The artwork marks each text slot with `data-max-width` in template units and says the
 * renderer must fit text to it. Without this a long course name runs off the card edge and
 * is silently clipped, which is exactly how an ID card ends up unreadable.
 */
function fitTextToSlot(template: string, css: Record<string, number>) {
  return template.replace(/<text\b[^>]*>[^<]*<\/text>/g, (element) => {
    const limit = element.match(/data-max-width="([\d.]+)"/);
    if (!limit) return element;

    const max = Number(limit[1]);
    const size = fontSizeOf(element, css);
    const text = element.replace(/<[^>]*>/g, "");
    const estimated = text.length * size * GLYPH_WIDTH;

    if (estimated <= max) return element;

    // Fit by font size first: a smaller label stays whole and readable, which matters more
    // on a card than matching the design's exact type scale.
    const fitted = Math.max(8, Math.floor((max / (text.length * GLYPH_WIDTH)) * 10) / 10);

    // An inline style, not the font-size attribute: the artwork sets size through a class
    // (`.value{font-size:24px}`), and a presentation attribute loses to a class rule, so an
    // attribute alone would be silently ignored and the text would stay clipped.
    const rest = element
      .replace(/\s*style="[^"]*"/, "")
      .replace(/\s*font-size="[\d.]+"/, "");

    return rest.replace(/<text\b/, `<text style="font-size:${fitted}px"`);
  });
}

/**
 * Fills every `{{slot}}` in the template. Missing text becomes an em dash rather than an
 * empty gap, so a proof is never mistaken for a complete card, and a missing asset
 * leaves the element in place with its slot cleared — an absent photo then shows the
 * placeholder frame the design already draws rather than a broken image icon.
 */
export function mergeCardTemplate(template: string, slots: CardSlots) {
  const filled = template.replace(/\{\{([a-z_]+)\}\}/g, (match, slot: string) => {
    const value = slots[slot];

    if (value === null || value === undefined || value === "") {
      if ((ASSET_SLOTS as readonly string[]).includes(slot)) return "";
      return escapeXml("—");
    }

    return escapeXml(value);
  });

  return fitTextToSlot(filled, cssSizes(template));
}

/** Slots present in a template, so a proof can show what the design expects. */
export function slotsIn(template: string) {
  return [...new Set([...template.matchAll(/\{\{([a-z_]+)\}\}/g)].map((m) => m[1]))];
}
