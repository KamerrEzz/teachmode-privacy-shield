/**
 * Dedicated screenshot script for README assets.
 * Produces: popup.png, shield-on.png, blur-mode.png, custom-patterns.png
 */
import { chromium } from "@playwright/test";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { mkdirSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";

const __dir    = dirname(fileURLToPath(import.meta.url));
const EXT_PATH = resolve(__dir, "..");
// Use http://localhost so the popup sees a valid hostname ("localhost")
const LOCAL_URL = "http://localhost/teachmode-test";
const TEST_HTML = readFileSync(join(__dir, "test-page.html"), "utf8");
const EDGE      = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const OUT_DIR  = join(EXT_PATH, "docs", "screenshots");
const TMPDIR   = mkdtempSync(join(tmpdir(), "teachmode-ss-"));
mkdirSync(OUT_DIR, { recursive: true });

const log = (m) => console.log(`[ss] ${m}`);

async function setDomainState(sw, domain, patch) {
  return sw.evaluate(async ([key, patch]) => {
    const r = await chrome.storage.local.get(key);
    const current = r[key] ?? { enabled: false, clickHide: false, blurMode: false, pinned: false };
    const updated = { ...current, ...patch };
    await chrome.storage.local.set({ [key]: updated });
    for (const tab of await chrome.tabs.query({})) {
      try { await chrome.tabs.sendMessage(tab.id, { type: "SET_STATE", state: updated }); } catch {}
    }
    return updated;
  }, [`domain:${domain}`, patch]);
}

(async () => {
  log("Launching Edge…");
  const ctx = await chromium.launchPersistentContext(TMPDIR, {
    executablePath: EDGE,
    headless: false,
    args: [
      `--disable-extensions-except=${EXT_PATH}`,
      `--load-extension=${EXT_PATH}`,
      "--no-first-run", "--no-default-browser-check",
    ],
    viewport: { width: 1280, height: 860 },
    timeout: 30000,
  });

  // SW may have already registered during launch; fall back to waitForEvent otherwise
  const existing = ctx.serviceWorkers();
  const sw = existing.length > 0
    ? existing[0]
    : await ctx.waitForEvent("serviceworker", { timeout: 20000 });
  const extId = sw.url().match(/chrome-extension:\/\/([^/]+)/)?.[1];
  log(`Extension ID: ${extId}`);
  await new Promise(r => setTimeout(r, 800));

  // ── 1. Popup screenshot ────────────────────────────────────────────────────
  log("Taking popup screenshot…");

  // Serve test-page from http://localhost so popup sees a real hostname
  const basePage = await ctx.newPage();
  await basePage.route(LOCAL_URL, (route) =>
    route.fulfill({ contentType: "text/html", body: TEST_HTML })
  );
  await basePage.goto(LOCAL_URL, { waitUntil: "domcontentloaded" });
  await basePage.bringToFront();
  await basePage.waitForTimeout(400);

  const popupDomain = "localhost";
  await sw.evaluate(async ([key, patterns]) => {
    await chrome.storage.local.set({
      [key]: { enabled: true, clickHide: false, blurMode: false, pinned: true },
      custom_patterns: patterns,
    });
  }, [
    `domain:${popupDomain}`,
    [{ key: "custom_1", label: "Project ID", pattern: "PROJ-\\d+" }],
  ]);

  // Open popup as a background page (basePage stays active → tabs.query returns it)
  const popupPage = await ctx.newPage();
  await popupPage.setViewportSize({ width: 320, height: 580 });
  // Keep basePage as active tab while popup navigates
  await basePage.bringToFront();
  await popupPage.goto(`chrome-extension://${extId}/popup/popup.html`, { waitUntil: "domcontentloaded" });
  await popupPage.waitForTimeout(900);

  // Open the Custom Patterns section
  await popupPage.click("#patternsToggle").catch(() => {});
  await popupPage.waitForTimeout(300);
  await popupPage.screenshot({ path: join(OUT_DIR, "popup.png") });
  log("  → popup.png");
  await popupPage.close();
  await basePage.close();

  // ── 2. shield-on.png — Privacy Shield active ──────────────────────────────
  log("Taking shield-on screenshot…");
  const page = await ctx.newPage();
  await page.setViewportSize({ width: 1280, height: 860 });
  await page.route(LOCAL_URL, (route) => route.fulfill({ contentType: "text/html", body: TEST_HTML }));
  await page.goto(LOCAL_URL, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(500);
  const domain = await page.evaluate(() => location.hostname);

  // Clear state, then enable
  await sw.evaluate(async ([key]) => { await chrome.storage.local.remove(key); await chrome.storage.local.remove("custom_patterns"); }, [`domain:${domain}`]);
  await page.goto(LOCAL_URL, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(500);
  await setDomainState(sw, domain, { enabled: true });
  await page.bringToFront();
  await page.waitForTimeout(900);
  await page.screenshot({ path: join(OUT_DIR, "shield-on.png"), fullPage: false });
  log("  → shield-on.png");

  // ── 3. blur-mode.png ──────────────────────────────────────────────────────
  log("Taking blur-mode screenshot…");
  await setDomainState(sw, domain, { enabled: true, clickHide: true, blurMode: true });
  await page.bringToFront();
  await page.waitForTimeout(500);
  // Click the last data row to blur it
  await page.locator(".row").nth(3).click({ force: true });
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(OUT_DIR, "blur-mode.png"), fullPage: false });
  log("  → blur-mode.png");

  // ── 4. custom-patterns.png ────────────────────────────────────────────────
  log("Taking custom-patterns screenshot…");
  await sw.evaluate((p) => chrome.storage.local.set({ custom_patterns: p }), [
    { key: "custom_proj",  label: "Project ID",  pattern: "PROJ-\\d+" },
    { key: "custom_build", label: "Build Tag",   pattern: "BUILD-[A-Z]+" },
  ]);
  await setDomainState(sw, domain, { enabled: true, clickHide: false, blurMode: false });
  await page.evaluate(() => {
    // Inject sample nodes if not present
    if (!document.getElementById("ss-custom")) {
      const wrap = document.createElement("div");
      wrap.id = "ss-custom";
      wrap.innerHTML = `
        <div class="row" style="margin-top:8px">Ticket: PROJ-9876 is in review</div>
        <div class="row">Deployed: BUILD-ALPHA to production</div>
      `;
      document.querySelector("section").appendChild(wrap);
    }
  });
  await page.goto(LOCAL_URL, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(800);
  // Re-inject after navigation since eval content is lost
  await page.evaluate(() => {
    if (!document.getElementById("ss-custom")) {
      const wrap = document.createElement("div");
      wrap.id = "ss-custom";
      wrap.innerHTML = `
        <div class="row" style="margin-top:8px">Ticket: PROJ-9876 is in review</div>
        <div class="row">Deployed: BUILD-ALPHA to production</div>
      `;
      document.querySelector("section").appendChild(wrap);
    }
  });
  // Re-enable after reload
  await setDomainState(sw, domain, { enabled: true });
  await page.bringToFront();
  await page.waitForTimeout(900);
  await page.screenshot({ path: join(OUT_DIR, "custom-patterns.png"), fullPage: false });
  log("  → custom-patterns.png");

  log(`\nAll screenshots saved to: ${OUT_DIR}`);
  await ctx.close();
})();
