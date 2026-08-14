import puppeteer from "puppeteer";
import fs from "fs";
import path from "path";

const BASE = process.env.BASE || "http://localhost:3000";
const OUT = "/home/metamorphosis/Lumiere/.playwright-mcp/shots";
const W = Number(process.env.W || 390);
const H = Number(process.env.H || 844);
const THEME = process.env.THEME || "retro-dark";
const ROUTE = process.env.ROUTE || "/dashboard";
const STEPS = Number(process.env.STEPS || 3);
const CLICK = process.env.CLICK || "";
const TAG = process.env.TAG || "";

fs.mkdirSync(OUT, { recursive: true });

const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const page = await browser.newPage();
await page.setViewport({ width: W, height: H, isMobile: W < 768, hasTouch: W < 768, deviceScaleFactor: 1 });

await page.goto(BASE + "/login", { waitUntil: "networkidle2" });
await page.evaluate((t) => localStorage.setItem("wv-global-theme", t), THEME);
await page.type("#email", "mobileaudit@example.com");
await page.type("#password", "AuditPass123!");
await Promise.all([page.click('button[type="submit"]'), page.waitForNavigation({ waitUntil: "networkidle2" }).catch(() => {})]);
await new Promise((r) => setTimeout(r, 2500));

await page.goto(BASE + ROUTE, { waitUntil: "networkidle2" });
await new Promise((r) => setTimeout(r, 2500));
// hide next dev tools overlay
await page.evaluate(() => { document.querySelectorAll("nextjs-portal").forEach(e => e.remove()); });

const name = (TAG || ROUTE.replace(/\//g, "_") || "_root") + `-${THEME}-${W}`;

if (CLICK) {
  await page.evaluate((sel) => {
    const el = [...document.querySelectorAll("button,a,[role=button]")].find(e => (e.textContent || "").trim().toLowerCase().includes(sel.toLowerCase()));
    if (el) el.click(); else throw new Error("no element matching " + sel);
  }, CLICK);
  await new Promise((r) => setTimeout(r, 1500));
  await page.evaluate(() => { document.querySelectorAll("nextjs-portal").forEach(e => e.remove()); });
}

for (let i = 0; i < STEPS; i++) {
  await page.evaluate((y) => window.scrollTo(0, y), i * (H - 60));
  await new Promise((r) => setTimeout(r, 900));
  await page.screenshot({ path: path.join(OUT, `${name}-${i}.png`) });
}
console.log("saved", name, "steps", STEPS);
await browser.close();
