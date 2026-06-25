const $ = (id) => document.getElementById(id);

// ── Tab / domain ─────────────────────────────────────────────────────────────

async function getCurrentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

function getDomain(tab) {
  try { return new URL(tab.url).hostname; } catch { return null; }
}

// ── Domain state ─────────────────────────────────────────────────────────────

async function getState(domain) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: "GET_STATE", domain }, (r) => {
      resolve(r?.state ?? { enabled: false, clickHide: false, blurMode: false, pinned: false });
    });
  });
}

async function patchState(domain, patch) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: "SET_STATE", domain, patch }, (r) => {
      resolve(r?.state ?? { enabled: false, clickHide: false, blurMode: false, pinned: false });
    });
  });
}

async function resetDomain(domain) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: "RESET_DOMAIN", domain }, (r) => resolve(r?.state));
  });
}

// ── Custom patterns (global storage) ─────────────────────────────────────────

async function getCustomPatterns() {
  const result = await chrome.storage.local.get("custom_patterns");
  return result.custom_patterns ?? [];
}

async function saveCustomPatterns(list) {
  await chrome.storage.local.set({ custom_patterns: list });
}

function validateRegex(source) {
  try { new RegExp(source); return null; }
  catch (e) { return e.message; }
}

// ── UI ───────────────────────────────────────────────────────────────────────

function updateUI(state) {
  $("toggleEnabled").checked   = state.enabled;
  $("toggleClickHide").checked = state.clickHide;
  $("toggleBlurMode").checked  = state.blurMode ?? false;
  $("togglePinned").checked    = state.pinned ?? false;

  $("toggleClickHide").disabled = !state.enabled;
  $("toggleBlurMode").disabled  = !state.enabled || !state.clickHide;

  const pinned = state.pinned ?? false;
  $("pinBadge").classList.toggle("visible", pinned);

  const dot  = $("statusDot");
  const text = $("statusText");

  if (state.enabled && state.clickHide) {
    dot.classList.add("active");
    text.textContent = state.blurMode ? "Active · Blur-Hide ON" : "Active · Click-Hide ON";
  } else if (state.enabled) {
    dot.classList.add("active");
    text.textContent = "Active";
  } else {
    dot.classList.remove("active");
    text.textContent = pinned ? "Inactive (auto on reload)" : "Inactive";
  }
}

// ── Custom patterns list UI ───────────────────────────────────────────────────

function renderPatternList(patterns) {
  const list = $("patternList");
  if (patterns.length === 0) {
    list.innerHTML = '<div class="pattern-empty">No custom patterns yet.</div>';
    return;
  }
  list.innerHTML = patterns.map((p, i) => `
    <div class="pattern-item" data-index="${i}">
      <span class="pattern-item-label">${escapeHtml(p.label || p.key)}</span>
      <span class="pattern-item-regex">${escapeHtml(p.pattern)}</span>
      <button class="btn-remove" data-index="${i}" title="Remove">✕</button>
    </div>
  `).join("");

  list.querySelectorAll(".btn-remove").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const idx = parseInt(btn.dataset.index, 10);
      const current = await getCustomPatterns();
      current.splice(idx, 1);
      await saveCustomPatterns(current);
      renderPatternList(current);
    });
  });
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ── Main ─────────────────────────────────────────────────────────────────────

(async () => {
  const tab    = await getCurrentTab();
  const domain = getDomain(tab);

  if (!domain || tab.url?.startsWith("chrome://") || tab.url?.startsWith("edge://")) {
    document.body.innerHTML =
      '<div style="padding:20px;color:#555;font-family:monospace;font-size:12px;">Not available on this page.</div>';
    return;
  }

  $("domainBadge").textContent = domain || "(local file)";

  // Load state
  const state = await getState(domain);
  updateUI(state);

  // Load patterns
  const patterns = await getCustomPatterns();
  renderPatternList(patterns);

  // ── Domain state toggles ──

  $("toggleEnabled").addEventListener("change", async (e) => {
    const updated = await patchState(domain, { enabled: e.target.checked });
    updateUI(updated);
  });

  $("toggleClickHide").addEventListener("change", async (e) => {
    const updated = await patchState(domain, { clickHide: e.target.checked });
    updateUI(updated);
  });

  $("toggleBlurMode").addEventListener("change", async (e) => {
    const updated = await patchState(domain, { blurMode: e.target.checked });
    updateUI(updated);
  });

  $("togglePinned").addEventListener("change", async (e) => {
    const updated = await patchState(domain, { pinned: e.target.checked });
    updateUI(updated);
  });

  // ── Reset ──

  $("btnReset").addEventListener("click", async () => {
    const st = await resetDomain(domain);
    // After reset: reflect storage state (enabled:false, pinned preserved)
    updateUI({ ...(st ?? {}), enabled: false });
  });

  // ── Custom patterns collapsible ──

  $("patternsToggle").addEventListener("click", () => {
    const body  = $("patternsBody");
    const arrow = $("patternsArrow");
    const open  = body.classList.toggle("open");
    arrow.classList.toggle("open", open);
  });

  // ── Add pattern ──

  const regexInput = $("patternRegex");
  const labelInput = $("patternLabel");
  const errorEl    = $("patternError");
  const btnAdd     = $("btnAddPattern");

  function clearError() { errorEl.textContent = ""; regexInput.classList.remove("error"); }

  regexInput.addEventListener("input", clearError);

  btnAdd.addEventListener("click", async () => {
    const pattern = regexInput.value.trim();
    const label   = labelInput.value.trim() || pattern.slice(0, 20);

    if (!pattern) {
      errorEl.textContent = "Pattern is required.";
      regexInput.classList.add("error");
      return;
    }

    const err = validateRegex(pattern);
    if (err) {
      errorEl.textContent = `Invalid regex: ${err}`;
      regexInput.classList.add("error");
      return;
    }

    clearError();
    const list = await getCustomPatterns();
    list.push({ key: `custom_${Date.now()}`, label, pattern });
    await saveCustomPatterns(list);
    renderPatternList(list);
    regexInput.value = "";
    labelInput.value = "";
  });

  // Allow Enter to add pattern
  [regexInput, labelInput].forEach((el) =>
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter") btnAdd.click();
    })
  );
})();
