const DEFAULT_STATE = {
  enabled: false,
  clickHide: false,
  blurMode: false,
  pinned: false,
};

async function getDomainState(domain) {
  const key = `domain:${domain}`;
  const result = await chrome.storage.local.get(key);
  return { ...DEFAULT_STATE, ...(result[key] ?? {}) };
}

async function setDomainState(domain, patch) {
  const key = `domain:${domain}`;
  const current = await getDomainState(domain);
  const updated = { ...current, ...patch };
  await chrome.storage.local.set({ [key]: updated });
  return updated;
}

async function getActiveDomain(tabId) {
  const tab = await chrome.tabs.get(tabId);
  return new URL(tab.url).hostname;
}

async function sendToTab(tabId, message) {
  try {
    await chrome.tabs.sendMessage(tabId, message);
  } catch {
    // Tab may not have the content script yet (e.g. chrome:// pages)
  }
}

// If pinned, force enabled:true in the response without writing to storage.
function resolveState(state) {
  if (state.pinned && !state.enabled) return { ...state, enabled: true };
  return state;
}

chrome.commands.onCommand.addListener(async (command) => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;

  const domain = await getActiveDomain(tab.id);

  if (command === "toggle-teachmode") {
    const state = await getDomainState(domain);
    const updated = await setDomainState(domain, { enabled: !state.enabled });
    await sendToTab(tab.id, { type: "SET_STATE", state: resolveState(updated) });
  }

  if (command === "toggle-clickhide") {
    const state = await getDomainState(domain);
    const updated = await setDomainState(domain, { clickHide: !state.clickHide });
    await sendToTab(tab.id, { type: "SET_STATE", state: resolveState(updated) });
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "GET_STATE") {
    (async () => {
      const state = await getDomainState(message.domain);
      sendResponse({ state: resolveState(state) });
    })();
    return true;
  }

  if (message.type === "SET_STATE") {
    (async () => {
      const updated = await setDomainState(message.domain, message.patch);
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) {
        await sendToTab(tab.id, { type: "SET_STATE", state: resolveState(updated) });
      }
      sendResponse({ state: updated });
    })();
    return true;
  }

  if (message.type === "RESET_DOMAIN") {
    (async () => {
      const key = `domain:${message.domain}`;
      const current = await getDomainState(message.domain);
      // Preserve pinned across resets — only clear visual state
      const reset = { ...DEFAULT_STATE, pinned: current.pinned };
      await chrome.storage.local.set({ [key]: reset });
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) {
        // Send enabled:false so current page uncensors, even if pinned
        await sendToTab(tab.id, { type: "SET_STATE", state: { ...reset, enabled: false } });
      }
      sendResponse({ ok: true, state: reset });
    })();
    return true;
  }
});
