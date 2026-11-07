/**
 * Verifies the ID card work end to end: the merge engine, and the rule that an enrolled
 * student gets a requested card dated from their intake rather than from today.
 *
 * Run: npx tsx scripts/verify-cards.ts
 */
import { readFileSync } from "node:fs";

import { addMonths, expiryForProgram } from "../lib/cards/validity";
import { escapeXml, mergeCardTemplate, slotsIn } from "../lib/cards/template";
import { A4, CR80, SHEET, paginateSheets, sheetGrid } from "../lib/cards/sheet";
import { qrSvgGroup, verifyUrl } from "../lib/cards/qr";

let passed = 0;
let failed = 0;

function check(label: string, ok: boolean, detail?: string) {
  if (ok) {
    passed += 1;
    console.log(`  ok   ${label}`);
  } else {
    failed += 1;
    console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

console.log("\ntemplate merge");
{
  const out = mergeCardTemplate("<t>{{full_name}}</t><t>{{reg_no}}</t>", {
    full_name: "Grace Wanjiru",
    reg_no: "EAVI/2026/0001",
  });
  check("fills every slot it is given", out === "<t>Grace Wanjiru</t><t>EAVI/2026/0001</t>", out);
}

{
  // A name with XML metacharacters must not be able to break the document.
  const out = mergeCardTemplate("<t>{{full_name}}</t>", { full_name: 'O\'Brien & Sons <Jr>' });
  check("escapes XML in a value", out === "<t>O&apos;Brien &amp; Sons &lt;Jr&gt;</t>", out);
}

{
  check("escapeXml handles the four metacharacters", escapeXml('&<>"') === "&amp;&lt;&gt;&quot;");
}

{
  // A missing text value shows an em dash, so a proof never looks complete when it is not.
  const out = mergeCardTemplate("<t>{{intake}}</t>", { intake: null });
  check("missing text becomes a dash", out === "<t>—</t>", out);
}

{
  // A missing asset leaves the element but clears its source, so the design's own
  // placeholder frame shows instead of a broken-image icon.
  const out = mergeCardTemplate('<image href="{{photo_url}}"/>', { photo_url: null });
  check("missing asset clears the source", out === '<image href=""/>', out);
}

{
  const out = mergeCardTemplate("<t>{{unknown_slot}}</t>", {});
  check("unknown text slot also becomes a dash", out === "<t>—</t>", out);
  check("slotsIn reports what the template wants", slotsIn("{{a}} {{b}} {{a}}").length === 2);
}

console.log("\ntext fits its slot");
{
  // A slot declares its limit; text that would overrun it is shrunk, because a course name
  // running off the card edge is how an ID card becomes unreadable.
  const long = "Certificate in Information Communication Technology";
  const out = mergeCardTemplate(
    '<text data-slot="course" data-max-width="545" x="275" y="272" class="value">{{course}}</text>',
    { course: long },
  );
  const size = Number(out.match(/style="font-size:([\d.]+)px"/)?.[1] ?? 0);
  const estimated = long.length * size * 0.56;
  check("long text is shrunk to fit", size > 0 && estimated <= 545, `size=${size} est=${Math.round(estimated)}`);
}

{
  // A value that already fits is left completely alone, so the design's type scale is kept.
  const out = mergeCardTemplate(
    '<text data-slot="serial" data-max-width="400" class="value">{{serial}}</text>',
    { serial: "IDC/2026/0001" },
  );
  check("text that fits keeps its design size", !/style="font-size/.test(out), out);
}

{
  // The artwork sizes text through a class rule, which beats a presentation attribute. The
  // fit must therefore be an inline style, or it is silently ignored and text stays clipped.
  const out = mergeCardTemplate(
    '<text data-slot="full_name" data-max-width="545" font-size="30" class="value">{{full_name}}</text>',
    { full_name: "A Very Long Student Name That Will Not Fit" },
  );
  check("the fit is an inline style, which beats the class rule", /style="font-size:[\d.]+px"/.test(out), out);
  check("no stale font-size attribute survives", !/\bfont-size="/.test(out), out);
  check("font-size appears once", (out.match(/font-size/g) || []).length === 1, out);
}

console.log("\ncard validity");
{
  const from = new Date(Date.UTC(2026, 0, 31, 12));
  const to = addMonths(from, 1);
  check("31 Jan + 1 month is 28 Feb, not 3 March", to.getUTCMonth() === 1 && to.getUTCDate() === 28, to.toISOString());
}

{
  const leap = addMonths(new Date(Date.UTC(2028, 0, 31, 12)), 1);
  check("31 Jan + 1 month is 29 Feb in a leap year", leap.getUTCDate() === 29, leap.toISOString());
}

{
  // The card is valid for as long as the programme runs, measured from the intake. These
  // numbers come from the record, never from a figure invented in this codebase.
  const to = expiryForProgram(new Date(Date.UTC(2026, 4, 4, 12)), 24);
  check(
    "a 24-month programme from May 2026 expires May 2028",
    to?.getUTCFullYear() === 2028 && to?.getUTCMonth() === 4,
    to?.toISOString() ?? "null",
  );
}

{
  const to = expiryForProgram(new Date(Date.UTC(2026, 0, 5, 12)), 12);
  check(
    "a 12-month programme from January 2026 expires January 2027",
    to?.getUTCFullYear() === 2027 && to?.getUTCMonth() === 0,
    to?.toISOString() ?? "null",
  );
}

{
  // A programme with no recorded duration yields no expiry date. A guessed date would be a
  // promise the college never made, printed in plastic.
  check("no duration means no expiry date", expiryForProgram(new Date(), null) === null);
  check("a zero duration is treated as unknown", expiryForProgram(new Date(), 0) === null);
}

{
  const to = addMonths(new Date(Date.UTC(2026, 4, 4, 12)), 24);
  check("date is preserved, not clamped needlessly", to.getUTCDate() === 4, to.toISOString());
}

console.log("\nprint sheet layout");
{
  const grid = sheetGrid();
  check("A4 landscape holds 2 columns of cards", grid.columns === 2, `columns=${grid.columns}`);
  check("A4 landscape holds 4 rows of cards", grid.rows === 4, `rows=${grid.rows}`);
  check("eight cards per sheet", grid.perPage === 8, `perPage=${grid.perPage}`);
}

{
  // Every card must sit inside the paper, or the printer clips the edge and the card is scrap.
  const grid = sheetGrid();
  const last = { xMm: 0, yMm: 0 };
  for (let i = 0; i < grid.perPage; i += 1) {
    const col = i % grid.columns;
    const row = Math.floor(i / grid.columns);
    last.xMm = Math.max(last.xMm, grid.offsetXMm + col * (CR80.widthMm + SHEET.gapMm) + CR80.widthMm);
    last.yMm = Math.max(last.yMm, grid.offsetYMm + row * (CR80.heightMm + SHEET.gapMm) + CR80.heightMm);
  }
  check("the last card ends inside the paper width", last.xMm <= A4.widthMm, `${Math.round(last.xMm)}mm of ${A4.widthMm}mm`);
  check("the last card ends inside the paper height", last.yMm <= A4.heightMm, `${Math.round(last.yMm)}mm of ${A4.heightMm}mm`);
}

{
  // A card is never scaled: 85.6mm is what a card printer accepts.
  check("the card is true CR80 width", CR80.widthMm === 85.6);
  check("the card is true CR80 height", Math.abs(CR80.heightMm - 53.98) < 0.001);
}

{
  const cards = Array.from({ length: 10 }, (_, i) => ({
    serial: `IDC/2026/000${i}`,
    label: `EAVI/2026/000${i}`,
    frontSvg: "",
    backSvg: "",
  }));
  const { sheets } = paginateSheets(cards);
  check("ten cards need two sheets", sheets.length === 2, `sheets=${sheets.length}`);
  check("the first sheet is full", sheets[0].fronts.length === 8, `fronts=${sheets[0].fronts.length}`);
  check("the second sheet holds the rest", sheets[1].fronts.length === 2, `fronts=${sheets[1].fronts.length}`);
  // Fronts and backs must line up, or a back prints on the wrong person's card.
  check(
    "each front is backed by the same card",
    sheets.every((sheet) => sheet.fronts.every((f, i) => f.card.serial === sheet.backs[i].card.serial)),
  );
}

{
  const { sheets } = paginateSheets([]);
  check("an empty run produces no sheets", sheets.length === 0);
}

console.log("\nverification code");
{
  const url = verifyUrl("https://eavi.college.eavi.shop/", "a4f2-token");

  check("the QR encodes a verification address, not student data", url.startsWith("https://"));
  check("the address carries only the token", url.endsWith("/verify/a4f2-token"), url);

  // A card that left the portal must never name the student in the code itself.
  for (const secret of ["EAVI/2026", "Amos", "Kiptoo"]) {
    check(`the code does not contain "${secret}"`, !url.includes(secret));
  }

  qrSvgGroup(url).then((group) =>
    check("the code renders as vector paths", group.includes("<path")),
  );
}

console.log("\nartwork ships with the build");
{
  const front = readFileSync("card-templates/front.svg", "utf8");
  const back = readFileSync("card-templates/back.svg", "utf8");

  check("front template exists and is an svg", front.startsWith("<svg"));

  // Every slot the artwork names must be one the renderer knows, or a card prints with a
  // dash where a real value should be and nobody notices until the plastic arrives.
  const known = new Set([
    "logo_url", "signature_url", "photo_url", "reg_no", "full_name", "course", "campus",
    "intake", "expiry_date", "issue_date", "website", "verify_token", "emergency_name",
    "emergency_phone", "contact_email",
  ]);
  const unknown = [...new Set([...slotsIn(front), ...slotsIn(back)])].filter((s) => !known.has(s));
  check("no template slot is unknown to the renderer", unknown.length === 0, unknown.join(", "));
  check("front names the student's name", slotsIn(front).includes("full_name"));
  check("back carries the verification token", slotsIn(back).includes("verify_token"));
}

console.log(`\n${failed === 0 ? "All checks passed." : `${failed} check(s) failed.`} ${passed} passed.`);
if (failed > 0) process.exit(1);
