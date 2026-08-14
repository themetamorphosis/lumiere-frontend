import puppeteer from "puppeteer";
import fs from "fs";
import path from "path";

const BASE = process.env.BASE || "http://localhost:3000";
const OUT = process.env.OUT || "/home/metamorphosis/Lumiere/.playwright-mcp/audit";
const WIDTH = Number(process.env.W || 390);
const HEIGHT = Number(process.env.H || 844);
const THEME = process.env.THEME || "retro-dark";
const SHOT = process.env.SHOT === "1";

const ROUTES = (process.env.ROUTES ||
  "/,/login,/register,/dashboard,/library/movies,/library/tv,/library/anime,/wishlist/movies,/discovery,/profile,/social,/ai")
  .split(",");

fs.mkdirSync(OUT, { recursive: true });

const AUDIT = () => {
  const vw = document.documentElement.clientWidth;
  const offenders = [];
  const seen = new Set();
  document.querySelectorAll("body *").forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return;
    if (r.right > vw + 1 || r.left < -1) {
      // only report if no scrollable ancestor is intentionally clipping it
      let p = el.parentElement, clipped = false;
      while (p && p !== document.body) {
        const cs = getComputedStyle(p);
        if (cs.overflowX === "hidden" || cs.overflowX === "auto" || cs.overflowX === "scroll") { clipped = true; break; }
        p = p.parentElement;
      }
      if (clipped) return;
      const c = typeof el.className === "string" ? el.className.trim().split(/\s+/).slice(0, 6).join(".") : "";
      const key = el.tagName + c;
      if (seen.has(key)) return;
      seen.add(key);
      offenders.push({
        el: el.tagName.toLowerCase() + (c ? "." + c : ""),
        L: Math.round(r.left), R: Math.round(r.right), W: Math.round(r.width),
        txt: (el.textContent || "").trim().slice(0, 40),
      });
    }
  });

  // tap targets smaller than 40px
  const small = [];
  document.querySelectorAll("a,button,input,select,[role=button]").forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return;
    if (r.height < 36 || r.width < 24) {
      const c = typeof el.className === "string" ? el.className.trim().split(/\s+/).slice(0, 4).join(".") : "";
      small.push({ el: el.tagName.toLowerCase() + (c ? "." + c : ""), w: Math.round(r.width), h: Math.round(r.height), txt: (el.textContent || "").trim().slice(0, 24) });
    }
  });

  return {
    vw,
    docScrollW: document.documentElement.scrollWidth,
    overflow: document.documentElement.scrollWidth > vw + 1,
    offenders: offenders.slice(0, 12),
    smallTargets: small.slice(0, 8),
    smallTargetCount: small.length,
  };
};

const browser = await puppeteer.launch({
  headless: "new",
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const page = await browser.newPage();
await page.setViewport({ width: WIDTH, height: HEIGHT, isMobile: WIDTH < 768, hasTouch: WIDTH < 768, deviceScaleFactor: 1 });

// login
await page.goto(BASE + "/login", { waitUntil: "networkidle2" });
await page.evaluate((t) => localStorage.setItem("wv-global-theme", t), THEME);
await page.type("#email", "mobileaudit@example.com");
await page.type("#password", "AuditPass123!");
await Promise.all([
  page.click('button[type="submit"]'),
  page.waitForNavigation({ waitUntil: "networkidle2" }).catch(() => {}),
]);
await new Promise((r) => setTimeout(r, 2500));

const results = {};
for (const route of ROUTES) {
  try {
    await page.goto(BASE + route, { waitUntil: "networkidle2", timeout: 45000 });
    await new Promise((r) => setTimeout(r, 2000));
    // trigger scroll-driven reveals
    await page.evaluate(async () => {
      const h = document.documentElement.scrollHeight;
      for (let y = 0; y < h; y += 400) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 60)); }
      window.scrollTo(0, 0);
    });
    await new Promise((r) => setTimeout(r, 800));
    results[route] = await page.evaluate(AUDIT);
    if (SHOT) {
      const name = route.replace(/\//g, "_") || "_root";
      await page.screenshot({ path: path.join(OUT, `${THEME}-${WIDTH}${name}.png`), fullPage: true });
    }
  } catch (e) {
    results[route] = { error: String(e).slice(0, 200) };
  }
}

console.log(JSON.stringify(results, null, 2));
await browser.close();
