#!/usr/bin/env node
/**
 * Measures every semantic colour pair the UI is allowed to use, and fails the run if a
 * pair falls under its WCAG AA threshold.
 *
 * The values here mirror app/styles/tokens.css. When a token changes, change it in both
 * files and re-run: `node scripts/check-contrast.mjs`. Ratios are printed with two
 * decimals so the numbers written in tokens.css comments can be copied from this output
 * instead of guessed.
 */
const colours = {
  bg: "#F5F6F8",
  surface: "#FFFFFF",
  surface2: "#EEF0F4",
  surface3: "#E4E8EE",
  text: "#161C26",
  textMuted: "#5A6474",
  border: "#DDE2EA",
  borderStrong: "#858E9D",
  primary: "#4B3FA8",
  primaryHover: "#3D338C",
  onPrimary: "#FFFFFF",
  positive: "#0F7B5F",
  attention: "#9A5B00",
  danger: "#B42318",
  info: "#1A5C88",
  focus: "#4B3FA8",
};

/** [foreground, background, minimum ratio, what the pair is for] */
const pairs = [
  ["text", "bg", 4.5, "body text on the page"],
  ["text", "surface", 4.5, "body text in a card"],
  ["text", "surface2", 4.5, "text in a table head / well"],
  ["text", "surface3", 4.5, "text on a selected row"],
  ["textMuted", "bg", 4.5, "secondary text on the page"],
  ["textMuted", "surface", 4.5, "secondary text in a card"],
  ["textMuted", "surface2", 4.5, "secondary text in a table head"],
  ["textMuted", "surface3", 4.5, "secondary text on a selected row"],
  ["primary", "surface", 4.5, "link / accent text on a card"],
  ["primary", "bg", 4.5, "link / accent text on the page"],
  ["onPrimary", "primary", 4.5, "label on a primary button"],
  ["onPrimary", "primaryHover", 4.5, "label on a hovered primary button"],
  ["positive", "surface", 4.5, "paid / verified text"],
  ["attention", "surface", 4.5, "warning text"],
  ["danger", "surface", 4.5, "error text"],
  ["info", "surface", 4.5, "informational text"],
  // --border is decorative (a card also differs by elevation), so it carries no ratio
  // requirement. --border-strong is what an input or checkbox boundary uses and must be
  // perceivable on its own (WCAG 1.4.11).
  ["borderStrong", "surface", 3, "input boundary against a card"],
  ["borderStrong", "bg", 3, "input boundary against the page"],
  ["focus", "surface", 3, "focus ring on a card"],
  ["focus", "bg", 3, "focus ring on the page"],
  ["primary", "surface", 3, "primary fill as a UI component"],
];

function channel(value) {
  const c = value / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminance(hex) {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function ratio(a, b) {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

let failures = 0;
const seen = new Set();

for (const [fg, bg, min, label] of pairs) {
  const key = `${fg}/${bg}`;
  const value = ratio(colours[fg], colours[bg]);
  const ok = value >= min;
  if (!ok) failures += 1;
  seen.add(key);
  console.log(
    `${ok ? "PASS" : "FAIL"}  ${fg}/${bg}  ${value.toFixed(2)}:1  (min ${min})  ${label}`,
  );
}

console.log(`\n${pairs.length} pairs checked, ${failures} below threshold.`);
process.exit(failures === 0 ? 0 : 1);
