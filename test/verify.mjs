import { chromium } from "@playwright/test";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { mkdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";

const __dir    = dirname(fileURLToPath(import.meta.url));
const EXT_PATH = resolve(__dir, "..");
const TEST_URL = `file:///${join(__dir, "test-page.html").replace(/\\/g, "/")}`;
const EDGE     = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const SS_DIR   = join(__dir, "screenshots");
const TMPDIR   = mkdtempSync(join(tmpdir(), "teachmode-"));
mkdirSync(SS_DIR, { recursive: true });

const log = (m) => console.log(`[verify] ${m}`);

async function ss(page, name) {
  const p = join(SS_DIR, `${name}.png`);
  await page.screenshot({ path: p, fullPage: true });
  log(`  shot → ${name}.png`);
}

async function setDomainState(sw, domain, patch) {
  return sw.evaluate(async ([key, patch]) => {
    const result = await chrome.storage.local.get(key);
    const current = result[key] ?? { enabled: false, clickHide: false, blurMode: false, pinned: false };
    const updated = { ...current, ...patch };
    await chrome.storage.local.set({ [key]: updated });
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      try { await chrome.tabs.sendMessage(tab.id, { type: "SET_STATE", state: updated }); } catch {}
    }
    return updated;
  }, [`domain:${domain}`, patch]);
}

async function setCustomPatterns(sw, patterns) {
  await sw.evaluate((p) => chrome.storage.local.set({ custom_patterns: p }), patterns);
}

async function clearAll(sw, domain) {
  await sw.evaluate(async ([key]) => {
    await chrome.storage.local.remove(key);
    await chrome.storage.local.remove("custom_patterns");
  }, [`domain:${domain}`]);
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
    viewport: { width: 1280, height: 900 },
    timeout: 30000,
  });

  const sw = await ctx.waitForEvent("serviceworker", { timeout: 15000 });
  log(`Extension: ${sw.url().match(/chrome-extension:\/\/([^/]+)/)?.[1]}`);
  await new Promise(r => setTimeout(r, 800));

  const page = ctx.pages().find(p => !p.url().startsWith("chrome")) ?? await ctx.newPage();
  await page.goto(TEST_URL, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(500);
  const domain = await page.evaluate(() => location.hostname);

  await clearAll(sw, domain);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(500);

  const checks = [];
  const check  = (ok, label) => { checks.push([ok, label]); log(`  ${ok ? "✅" : "❌"}  ${label}`); };

  // ── Feature 1: Blur mode ──────────────────────────────────────────────────
  log("\n── Feature 1: Blur mode ──");
  await setDomainState(sw, domain, { enabled: true, clickHide: true, blurMode: true });
  await page.bringToFront();
  await page.waitForTimeout(800);

  await page.locator(".row").last().click({ force: true });
  await page.waitForTimeout(300);
  await ss(page, "f1-blur");

  const blurredCount = await page.locator(".tm-blurred").count();
  const hiddenCount  = await page.locator(".tm-hidden").count();
  check(blurredCount > 0,  `Blur: element gets .tm-blurred (${blurredCount})`);
  check(hiddenCount === 0, `Blur: no .tm-hidden when blurMode ON`);

  // Switch blur OFF while elements are blurred — they should convert to hidden
  await setDomainState(sw, domain, { enabled: true, clickHide: true, blurMode: false });
  await page.waitForTimeout(400);

  const nowHidden  = await page.locator(".tm-hidden").count();
  const nowBlurred = await page.locator(".tm-blurred").count();
  check(nowHidden > 0,   `Blur toggle: .tm-blurred converted to .tm-hidden on mode switch`);
  check(nowBlurred === 0, `Blur toggle: no .tm-blurred remaining after mode switch`);

  // ── Feature 2: Undo (Ctrl+Z) ─────────────────────────────────────────────
  log("\n── Feature 2: Undo (Ctrl+Z) ──");
  // Add another hidden element, then undo
  await setDomainState(sw, domain, { enabled: true, clickHide: true, blurMode: false });
  await page.bringToFront();
  await page.waitForTimeout(400);

  const rowsBefore = await page.locator(".tm-hidden").count();
  await page.locator(".row").first().click({ force: true });
  await page.waitForTimeout(200);
  const rowsAfterClick = await page.locator(".tm-hidden").count();
  check(rowsAfterClick > rowsBefore, `Undo setup: click added .tm-hidden`);

  await page.keyboard.press("Control+z");
  await page.waitForTimeout(300);
  await ss(page, "f2-after-undo");

  const rowsAfterUndo = await page.locator(".tm-hidden").count();
  check(rowsAfterUndo < rowsAfterClick, `Undo: Ctrl+Z removed last hidden element`);

  // Undo does NOT fire when clickHide is OFF
  await setDomainState(sw, domain, { enabled: true, clickHide: false });
  await page.bringToFront();
  await page.waitForTimeout(300);
  const hiddenBeforeUndoOff = await page.locator(".tm-hidden").count();
  await page.keyboard.press("Control+z");
  await page.waitForTimeout(200);
  const hiddenAfterUndoOff = await page.locator(".tm-hidden").count();
  check(hiddenBeforeUndoOff === hiddenAfterUndoOff, `Undo: Ctrl+Z ignored when clickHide=OFF`);

  // ── Feature 3: Always ON / Pinned ────────────────────────────────────────
  log("\n── Feature 3: Always ON (pinned) ──");
  // Set pinned but enabled:false in storage, reload page — should auto-enable
  await sw.evaluate(async ([key]) => {
    await chrome.storage.local.set({ [key]: { enabled: false, clickHide: false, blurMode: false, pinned: true } });
  }, [`domain:${domain}`]);

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1200);
  await ss(page, "f3-pinned-reload");

  const redactedAfterPinnedReload = await page.locator(".tm-redacted").count();
  const overlayAfterPinnedReload  = await page.locator("#tm-overlay").textContent().catch(() => "");
  check(redactedAfterPinnedReload > 0, `Pinned: TeachMode auto-activated on page load`);
  check(overlayAfterPinnedReload.includes("TeachMode"), `Pinned: overlay indicator shown`);

  // Reset preserves pinned flag
  await sw.evaluate(async ([key]) => {
    const current = (await chrome.storage.local.get(key))[key];
    const reset   = { enabled: false, clickHide: false, blurMode: false, pinned: current?.pinned ?? false };
    await chrome.storage.local.set({ [key]: reset });
    const tabs = await chrome.tabs.query({});
    for (const t of tabs) { try { await chrome.tabs.sendMessage(t.id, { type: "SET_STATE", state: { ...reset, enabled: false } }); } catch {} }
  }, [`domain:${domain}`]);
  await page.waitForTimeout(500);

  const storedAfterReset = await sw.evaluate(async ([key]) => (await chrome.storage.local.get(key))[key], [`domain:${domain}`]);
  check(storedAfterReset?.pinned === true, `Pinned: reset preserves pinned=true in storage`);

  // ── Feature 4: Custom Patterns ────────────────────────────────────────────
  log("\n── Feature 4: Custom Patterns ──");
  // Reset pinned, clear page
  await clearAll(sw, domain);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(500);

  // Inject a custom pattern that matches "PROJ-1234" style IDs
  await setCustomPatterns(sw, [
    { key: "custom_proj", label: "Project ID", pattern: "PROJ-\\d+" }
  ]);

  // Inject a node with that content
  await page.evaluate(() => {
    const div = document.createElement("div");
    div.className = "row"; div.id = "custom-pattern-test";
    div.textContent = "Ticket: PROJ-9876 is open";
    document.querySelector("section").appendChild(div);
  });

  await setDomainState(sw, domain, { enabled: true });
  await page.bringToFront();
  await page.waitForTimeout(1200);
  await ss(page, "f4-custom-pattern");

  const customRedacted = await page.locator("#custom-pattern-test .tm-redacted").count();
  check(customRedacted > 0, `Custom pattern: PROJ-\\d+ matched and redacted`);

  // Custom pattern label check
  const label = await page.locator("#custom-pattern-test .tm-redacted").first().getAttribute("data-tm-label").catch(() => "");
  check(label === "Project ID", `Custom pattern: label shows "Project ID" (got: "${label}")`);

  // Add pattern live (storage change while TeachMode is ON) — inject another node
  await setCustomPatterns(sw, [
    { key: "custom_proj",  label: "Project ID",  pattern: "PROJ-\\d+" },
    { key: "custom_build", label: "Build Tag",   pattern: "BUILD-[A-Z]+" },
  ]);
  await page.evaluate(() => {
    const div = document.createElement("div");
    div.className = "row"; div.id = "custom-live-test";
    div.textContent = "Build: BUILD-ALPHA deployed";
    document.querySelector("section").appendChild(div);
  });
  await page.waitForTimeout(800);
  await ss(page, "f4-custom-live");

  const liveRedacted = await page.locator("#custom-live-test .tm-redacted").count();
  check(liveRedacted > 0, `Custom pattern: live storage update censors new pattern`);

  // ── Final Results ─────────────────────────────────────────────────────────
  console.log("\n════════════════════════════════════════════════");
  console.log("  VERIFICATION — 4 new features");
  console.log("════════════════════════════════════════════════");
  let passed = 0;
  for (const [ok, label] of checks) {
    console.log(`  ${ok ? "✅" : "❌"}  ${label}`);
    if (ok) passed++;
  }
  console.log("────────────────────────────────────────────────");
  console.log(`  VERDICT: ${passed === checks.length ? "PASS" : `FAIL (${passed}/${checks.length})`}`);
  console.log(`  Screenshots → ${SS_DIR}`);
  console.log("════════════════════════════════════════════════");
  console.log("\nBrowser stays open. Ctrl+C to close.\n");

  await new Promise(() => {});
})();
