import assert from "node:assert/strict";
import puppeteer from "puppeteer";

export const frontend = new URL(process.env.LUMIERE_WEB_URL || "http://localhost:3000");
export const apiBase = (process.env.LUMIERE_API_URL || "http://127.0.0.1:8000/api/v1").replace(/\/$/, "");

export function requireLocalFixtureServices() {
  for (const url of [frontend, new URL(apiBase)]) {
    assert(
      ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname),
      "This check creates test data. Use loopback services backed by a disposable database.",
    );
  }
}

export function launchBrowser() {
  return puppeteer.launch({
    headless: true,
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
}

export async function clickButton(page, label, within = "body") {
  const match = await page.waitForFunction((text, selector) => {
    const buttons = document.querySelector(selector)?.querySelectorAll("button");
    return Array.from(buttons ?? []).find((button) =>
      button.offsetWidth && !button.disabled && button.textContent.trim().toLowerCase() === text.toLowerCase(),
    );
  }, {}, label, within);
  await match.asElement().click();
}

export async function expectText(page, selector, text) {
  await page.waitForFunction((selector, text) =>
    document.querySelector(selector)?.innerText.toLowerCase().includes(text.toLowerCase()),
  {}, selector, text);
}
