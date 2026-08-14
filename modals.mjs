import puppeteer from "puppeteer";
import fs from "fs";
import path from "path";

const BASE = process.env.BASE || "http://localhost:3000";
const OUT = "/home/metamorphosis/Lumiere/.playwright-mcp/shots";
const W = Number(process.env.W || 390);
const H = Number(process.env.H || 844);

fs.mkdirSync(OUT, { recursive: true });

const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const page = await browser.newPage();
await page.setViewport({ width: W, height: H, isMobile: W < 768, hasTouch: W < 768, deviceScaleFactor: 1 });

await page.goto(BASE + "/login", { waitUntil: "networkidle2" });
await page.type("#email", "mobileaudit@example.com");
await page.type("#password", "AuditPass123!");
await Promise.all([page.click('button[type="submit"]'), page.waitForNavigation({ waitUntil: "networkidle2" }).catch(() => {})]);
await new Promise((r) => setTimeout(r, 2500));

const clean = () => page.evaluate(() => document.querySelectorAll("nextjs-portal").forEach((e) => e.remove()));

const audit = () => page.evaluate(() => {
  const vw = document.documentElement.clientWidth;
  const vh = document.documentElement.clientHeight;
  const bad = [];
  document.querySelectorAll("body *").forEach((el) => {
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) return;
    if (r.right > vw + 1 || r.left < -1 || r.bottom > vh + 1 && getComputedStyle(el).position === "fixed") {
      let p = el.parentElement, clipped = false;
      while (p && p !== document.body) {
        const cs = getComputedStyle(p);
        if (["hidden", "auto", "scroll"].includes(cs.overflowX) || ["hidden", "auto", "scroll"].includes(cs.overflowY)) { clipped = true; break; }
        p = p.parentElement;
      }
      if (clipped) return;
      const c = typeof el.className === "string" ? el.className.trim().split(/\s+/).slice(0, 5).join(".") : "";
      bad.push({ el: el.tagName.toLowerCase() + (c ? "." + c : ""), L: Math.round(r.left), R: Math.round(r.right), T: Math.round(r.top), B: Math.round(r.bottom), txt: (el.textContent || "").trim().slice(0, 30) });
    }
  });
  return { vw, vh, docScrollW: document.documentElement.scrollWidth, bad: bad.slice(0, 10) };
});

const shot = async (name) => { await clean(); await page.screenshot({ path: path.join(OUT, `modal-${name}-${W}.png`) }); };

const clickText = async (txt, tags = "button,a,[role=button]") =>
  page.evaluate((t, sel) => {
    const el = [...document.querySelectorAll(sel)].find((e) => (e.textContent || "").trim().toLowerCase().includes(t.toLowerCase()));
    if (!el) throw new Error("no match: " + t);
    el.click();
  }, txt, tags);

const results = {};

// 1. Library import modal
await page.goto(BASE + "/library/movies", { waitUntil: "networkidle2" });
await new Promise((r) => setTimeout(r, 2500));
try {
  await clickText("import");
  await new Promise((r) => setTimeout(r, 1200));
  results.import = await audit();
  await shot("import");
} catch (e) { results.import = { error: String(e).slice(0, 120) }; }

// 2. Editor modal — click a media card
await page.goto(BASE + "/library/movies", { waitUntil: "networkidle2" });
await new Promise((r) => setTimeout(r, 2500));
try {
  await page.evaluate(() => {
    const card = document.querySelector('[data-testid="media-card"]') || document.querySelectorAll("main img")[2]?.closest("div[class*=group],article,li,div");
    card?.click();
  });
  await new Promise((r) => setTimeout(r, 1500));
  results.editor = await audit();
  await shot("editor");
} catch (e) { results.editor = { error: String(e).slice(0, 120) }; }

// 3. AI chat modal (floating button)
await page.goto(BASE + "/dashboard", { waitUntil: "networkidle2" });
await new Promise((r) => setTimeout(r, 2500));
try {
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll("button")].filter((b) => getComputedStyle(b).position === "fixed");
    if (!btns.length) throw new Error("no fixed button");
    btns[btns.length - 1].click();
  });
  await new Promise((r) => setTimeout(r, 1500));
  results.aichat = await audit();
  await shot("aichat");
} catch (e) { results.aichat = { error: String(e).slice(0, 120) }; }

// 4. Discovery detail overlay
await page.goto(BASE + "/discovery", { waitUntil: "networkidle2" });
await new Promise((r) => setTimeout(r, 3500));
try {
  await clickText("details");
  await new Promise((r) => setTimeout(r, 2000));
  results.detail = await audit();
  await shot("detail");
} catch (e) { results.detail = { error: String(e).slice(0, 120) }; }

// 5. Mobile nav drawer
await page.goto(BASE + "/library/movies", { waitUntil: "networkidle2" });
await new Promise((r) => setTimeout(r, 2000));
try {
  await page.click('button[aria-label="Toggle navigation"]');
  await new Promise((r) => setTimeout(r, 900));
  results.drawer = await audit();
  await shot("drawer");
} catch (e) { results.drawer = { error: String(e).slice(0, 120) }; }

console.log(JSON.stringify(results, null, 2));
await browser.close();
