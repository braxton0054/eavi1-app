import { chromium } from "playwright-core";

const pages = [
  ["/", "home"],
  ["/login", "login"],
];

const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  args: ["--no-sandbox"],
});
const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
const mobile = await browser.newContext({ viewport: { width: 390, height: 844 } });

for (const [path, name] of pages) {
  const page = await ctx.newPage();
  await page.goto(`http://localhost:3111${path}`, { waitUntil: "networkidle" });
  await page.screenshot({ path: `/tmp/shot-${name}-desktop.png`, fullPage: name === "home" });
  const m = await mobile.newPage();
  await m.goto(`http://localhost:3111${path}`, { waitUntil: "networkidle" });
  await m.screenshot({ path: `/tmp/shot-${name}-mobile.png`, fullPage: false });
  console.log(`shot ${name}`);
}
await browser.close();
