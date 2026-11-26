import assert from "node:assert/strict";

const configuredUrl = process.env.STAGING_API_URL;
if (!configuredUrl) throw new Error("Set STAGING_API_URL to the staging API base, including /api/v1.");

const api = new URL(configuredUrl);
assert.equal(api.protocol, "https:", "Use the staging HTTPS endpoint.");
assert(!api.username && !api.password && !api.search && !api.hash, "Provide only the staging API base URL.");
assert(api.pathname.replace(/\/$/, "").endsWith("/api/v1"), "The staging base URL must end in /api/v1.");
const base = api.href.replace(/\/$/, "");

async function getJson(path) {
  const response = await fetch(base + path, {
    signal: AbortSignal.timeout(15000),
    redirect: "error",
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const details = body?.detail?.code === "tmdb_credentials_required"
      ? " The staging backend needs a valid TMDB API key."
      : "";
    throw new Error(`${path} returned HTTP ${response.status}.${details}`);
  }
  return response.json();
}

const expectedId = 603;
const search = await getJson("/media/search?type=movie&query=The%20Matrix");
assert(
  search.results?.some((movie) => movie.tmdbId === expectedId && movie.year === 1999),
  "The staging search did not return the 1999 Matrix entry.",
);
const detail = await getJson(`/media/details?type=movie&tmdb_id=${expectedId}`);
assert.equal(detail.tmdbId, expectedId);
assert.equal(detail.year, 1999);
console.log("Staging returned the expected live TMDB search result and details.");
