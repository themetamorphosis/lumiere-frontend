import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { apiBase, frontend, launchBrowser, requireLocalFixtureServices } from "./release-browser.mjs";

const titleCount = 10_000;
const batchSize = 100;
const pageSize = 500;
const apiBudgetMs = 250;
const libraryBudgetMs = 4500;

requireLocalFixtureServices();

async function api(path, options) {
  const response = await fetch(apiBase + path, { signal: AbortSignal.timeout(15_000), ...options });
  assert(response.ok, `${path} returned HTTP ${response.status}`);
  return response.json();
}

const fixtureId = randomUUID();
const { session } = await api("/auth/register?create_session=true", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    email: `performance-${fixtureId}@example.com`,
    name: "Performance QA",
    password: `Performance1!${fixtureId}`,
  }),
});
assert(session?.access_token, "Fixture registration did not create a session");
const auth = { Authorization: `Bearer ${session.access_token}` };

for (let offset = 0; offset < titleCount; offset += batchSize) {
  const items = Array.from({ length: batchSize }, (_, index) => ({
    title: `Benchmark Movie ${offset + index + 1}`,
    tmdbId: 9_300_000 + offset + index,
    mediaType: "movie",
    status: "watched",
    year: 1999,
    genres: ["Drama"],
    runtime: 100,
    description: "A local performance fixture with completed catalogue metadata.",
    coverUrl: "/file.svg",
  }));
  const result = await api("/watchlist/batch", {
    method: "POST",
    headers: { ...auth, "Content-Type": "application/json" },
    body: JSON.stringify(items),
  });
  assert.equal(result.imported, items.length, `Fixture import failed at offset ${offset}`);
}

const apiTimes = [];
for (let offset = 0; offset < titleCount; offset += pageSize) {
  const start = performance.now();
  const page = await api(`/watchlist?limit=${pageSize}&offset=${offset}`, { headers: auth });
  apiTimes.push(performance.now() - start);
  assert.equal(page.total, titleCount);
  assert.equal(page.items.length, pageSize);
  assert.equal(page.has_more, offset + pageSize < titleCount);
}

const browser = await launchBrowser();
const libraryTimes = [];
try {
  for (let run = 0; run < 5; run++) {
    const context = await browser.createBrowserContext();
    try {
      await context.setCookie({
        name: "auth_token", value: session.access_token, domain: frontend.hostname,
        path: "/", httpOnly: true, secure: true, sameSite: "Strict",
      });
      const page = await context.newPage();
      await page.setViewport({ width: 1440, height: 900 });
      await page.setCacheEnabled(false);
      await page.emulateCPUThrottling(4);
      const cdp = await page.createCDPSession();
      await cdp.send("Network.emulateNetworkConditions", {
        offline: false, latency: 25,
        downloadThroughput: 20_000_000 / 8, uploadThroughput: 10_000_000 / 8,
      });
      await page.goto(new URL("/library/movies", frontend).href, { waitUntil: "domcontentloaded" });
      const libraryReady = await page.waitForFunction((total) => {
        const firstTotal = document.querySelector('[aria-label="Library totals"] > div:first-child > span:last-child');
        const movie = document.querySelector('[aria-label^="Open Benchmark Movie"]');
        return firstTotal?.textContent.trim() === String(total) && movie?.getBoundingClientRect().height
          ? performance.now()
          : false;
      }, {}, titleCount);
      libraryTimes.push(await libraryReady.jsonValue());
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}

function report(label, samples, budget) {
  const sorted = [...samples].sort((a, b) => a - b);
  const percentile = (fraction) => sorted[Math.ceil(sorted.length * fraction) - 1];
  const p95 = percentile(0.95);
  console.log(`${label} (${samples.length} samples): p50 ${percentile(0.5).toFixed(0)} ms, p95 ${p95.toFixed(0)} ms, budget ${budget} ms`);
  return p95 <= budget;
}

const apiPassed = report("500-title API page", apiTimes, apiBudgetMs);
const libraryPassed = report("10,000-title library ready", libraryTimes, libraryBudgetMs);
assert(apiPassed && libraryPassed, "Performance budget exceeded");
