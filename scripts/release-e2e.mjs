import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { clickButton, expectText, frontend, launchBrowser, requireLocalFixtureServices } from "./release-browser.mjs";

requireLocalFixtureServices();

const id = randomUUID().slice(0, 8);
const email = `Release-${id}@EXAMPLE.COM`;
const password = "ReleaseQa1!" + randomUUID();
const title = `Release, Test ${id}`;
const slug = `release-qa-${id}`;
const path = (pathname) => new URL(pathname, frontend).href;

const browser = await launchBrowser();
try {
  const owner = await browser.newPage();
  owner.setDefaultTimeout(20000);
  await owner.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await owner.goto(path("/register"), { waitUntil: "networkidle2" });
  for (const [field, value] of Object.entries({
    name: "Release QA", email, password, confirmPassword: password,
  })) {
    await owner.type(`[name="${field}"]`, value);
  }
  await owner.click('button[type="submit"]');
  await owner.waitForFunction(() => location.pathname === "/dashboard");
  await expectText(owner, "main h1", "Add your first title");

  // Runtime configuration controls both the endpoint and the visible launcher.
  const settings = await owner.evaluate(async () => {
    const response = await fetch("/api/chat");
    return response.json();
  });
  assert.equal(typeof settings.enabled, "boolean");
  if (settings.enabled) {
    await owner.waitForSelector('[aria-label="Open AI assistant"]');
  } else {
    assert.equal(await owner.$('[aria-label="Open AI assistant"]'), null);
    const status = await owner.evaluate(async () => (await fetch("/api/chat", { method: "POST" })).status);
    assert.equal(status, 503);
  }

  await owner.goto(path("/library/movies"), { waitUntil: "networkidle2" });
  await clickButton(owner, "Import", "#add-title");
  const csv = `Title,Year,Status,Favorite,TMDB ID\n"${title}",1999,watched,true,9183000`;
  await owner.$eval('[role="dialog"] textarea', (textarea, text) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set;
    setter.call(textarea, text);
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
  }, csv);
  await expectText(owner, '[role="dialog"]', "1 ready to import");
  await clickButton(owner, "Import 1 titles", '[role="dialog"]');
  await expectText(owner, '[role="dialog"]', "1 imported · 0 already present · 0 unconfirmed · 0 invalid");
  await clickButton(owner, "Done", '[role="dialog"]');
  await owner.reload({ waitUntil: "networkidle2" });
  await expectText(owner, "main", title);

  await owner.goto(path("/profile#share"), { waitUntil: "networkidle2" });
  await clickButton(owner, "[ NEW SHARE LINK ]", "#share");
  await owner.type("#share-handle", slug);
  await clickButton(owner, "[ CREATE LINK ]", "#share");
  const shareAnchor = `a[href="/share/${slug}"]`;
  await owner.waitForSelector(shareAnchor);

  const publicContext = await browser.createBrowserContext();
  const visitor = await publicContext.newPage();
  const publicPath = path(`/share/${slug}`);
  assert.equal((await visitor.goto(publicPath, { waitUntil: "domcontentloaded" })).status(), 200);
  await expectText(visitor, "main", title);

  await clickButton(owner, "Revoke", "#share");
  await owner.waitForSelector(shareAnchor, { hidden: true });
  assert.equal((await visitor.reload({ waitUntil: "domcontentloaded" })).status(), 404);
  await publicContext.close();
  console.log("Registration, CSV import and reload, anonymous sharing, and link revocation passed.");
} finally {
  await browser.close();
}
