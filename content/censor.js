(() => {
  // ─── Pattern catalog ───────────────────────────────────────────────────────
  //
  // Priority order (first match wins the label):
  //   1. DOMAIN_RULES[hostname]   — most targeted, only on matching domain
  //   2. GLOBAL_PATTERNS          — high-specificity, safe everywhere
  //   3. BUILTIN_PATTERNS         — broader coverage (IPs, email, CF, generic tokens)
  //   4. custom user patterns
  //
  // ── HIGH-specificity global patterns (all domains) ──────────────────────────

  const GLOBAL_PATTERNS = [
    // AWS
    { key: "awsAccessKey",  label: "AWS Access Key",  regex: /\bAKI[AO][0-9A-Z]{16}\b/g },
    { key: "awsArn",        label: "AWS ARN",         regex: /\barn:[a-z0-9-]+:[a-z0-9-]*:[a-z0-9-]*:\d{12}:[^\s<"']+/gi },
    { key: "awsS3Uri",      label: "S3 URI",          regex: /\bs3:\/\/[a-z0-9][a-z0-9.-]{1,61}[a-z0-9](\/[^\s"']*)?/g },
    { key: "awsEcrUri",     label: "ECR URI",         regex: /\b\d{12}\.dkr\.ecr\.[a-z0-9-]+\.amazonaws\.com\b/g },
    // GitHub tokens (all have typed prefixes)
    { key: "githubToken",   label: "GitHub Token",    regex: /\bgh[pousr]_[A-Za-z0-9]{36,}\b/g },
    { key: "githubPAT",     label: "GitHub Token",    regex: /\bgithub_pat_[A-Za-z0-9_]{82}\b/g },
    { key: "npmToken",      label: "npm Token",       regex: /\bnpm_[A-Za-z0-9]{36}\b/g },
    // GCP
    { key: "gcpApiKey",     label: "GCP API Key",     regex: /\bAIza[0-9A-Za-z_-]{35}\b/g },
    { key: "gcpSA",         label: "GCP Svc Account", regex: /\b[a-z][a-z0-9-]+@[a-z][a-z0-9-]+\.iam\.gserviceaccount\.com\b/g },
    { key: "gcpOAuth",      label: "GCP OAuth Client",regex: /\b[0-9]+-[a-z0-9]+\.apps\.googleusercontent\.com\b/g },
    { key: "gcpGcsUri",     label: "GCS URI",         regex: /\bgs:\/\/[a-z0-9][a-z0-9._-]{1,61}[a-z0-9](\/[^\s"']*)?/g },
    // Stripe (all have typed prefixes — safest set on this list)
    { key: "stripeKey",     label: "Stripe Key",      regex: /\b[sr]k_(live|test)_[0-9A-Za-z]{24,}/g },
    { key: "stripeRK",      label: "Stripe Restricted",regex: /\brk_(live|test)_[0-9A-Za-z]{24,}/g },
    { key: "stripeWebhook", label: "Stripe Webhook",  regex: /\bwhsec_[A-Za-z0-9+/=]{20,}/g },
    { key: "stripeObj",     label: "Stripe ID",       regex: /\b(acct|cus|pi|pm|sub|in|ch|prod|price|re)_[0-9A-Za-z]{14,}/g },
    // DigitalOcean — new token format
    { key: "doToken",       label: "DO Token",        regex: /\bdop_v1_[a-f0-9]{64}\b/g },
    // Render
    { key: "renderKey",     label: "Render API Key",  regex: /\brnd_[A-Za-z0-9]{36,}\b/g },
    // Render service ID
    { key: "renderSvc",     label: "Render Service",  regex: /\bsrv-[a-z0-9]{20}\b/g },
    // Sentry
    { key: "sentryToken",   label: "Sentry Token",    regex: /\bsntrys_[A-Za-z0-9+/=]{60,}/g },
    { key: "sentryDsn",     label: "Sentry DSN",      regex: /https?:\/\/[a-f0-9]+@o\d+\.ingest(\.[a-z]+)?\.sentry\.io\/\d+/g },
    // Fly.io
    { key: "flyToken",      label: "Fly.io Token",    regex: /\bfo1_[A-Za-z0-9+/=]{36,}/g },
    { key: "flyBearer",     label: "Fly.io Token",    regex: /\bFlyV1 [A-Za-z0-9+/=]{80,}/g },
    { key: "flyDomain",     label: "Fly.io App",      regex: /\b[a-z0-9-]+\.fly\.dev\b/g },
    // MongoDB connection strings
    { key: "mongoUri",      label: "MongoDB URI",     regex: /\bmongodb(\+srv)?:\/\/[^\s<"']+/g },
    // Supabase
    { key: "supabaseUrl",   label: "Supabase URL",    regex: /\b[a-z]{20}\.supabase\.co\b/g },
    { key: "supabasePg",    label: "Supabase DB",     regex: /\bpostgresql?:\/\/[^\s<"']*\.supabase\.co[^\s<"']*/g },
    // Railway
    { key: "railwayDomain", label: "Railway URL",     regex: /\b[a-z0-9-]+\.up\.railway\.app\b/g },
    { key: "railwayPg",     label: "Railway DB",      regex: /\bpostgresql?:\/\/[^\s<"']+\.railway\.app[^\s<"']*/g },
    // Heroku postgres (conn string is specific enough globally)
    { key: "herokuPg",      label: "Heroku DB",       regex: /\bpostgres:\/\/[a-z0-9]+:[^@]+@[a-z0-9-]+\.compute-1\.amazonaws\.com[^\s<"']*/g },
  ];

  // ── MEDIUM-specificity patterns scoped to their domain ──────────────────────
  // Only activated when the page hostname matches the key (or its subdomains).

  const DOMAIN_RULES = {
    // AWS Console: account IDs are 12-digit numbers — too generic globally
    "console.aws.amazon.com": [
      { key: "awsAccountId",  label: "AWS Account ID", regex: /\b\d{12}\b/g },
      { key: "awsEndpoint",   label: "AWS Endpoint",   regex: /\b[a-z0-9-]+\.amazonaws\.com\b/g },
    ],
    // Azure Portal: UUIDs appear as subscription/tenant/client IDs
    "portal.azure.com": [
      { key: "azureUuid",     label: "Azure ID",       regex: /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi },
      { key: "azureConnStr",  label: "Azure Conn",     regex: /(?:DefaultEndpointsProtocol=|Endpoint=sb:\/\/|Server=tcp:)[^"'\n<]{10,}/g },
      { key: "azureStorage",  label: "Azure Storage Key", regex: /\b[A-Za-z0-9+/]{86}==\b/g },
    ],
    // GCP Console: 12-digit project numbers
    "console.cloud.google.com": [
      { key: "gcpProjectNum", label: "GCP Project #",  regex: /\b\d{12}\b/g },
    ],
    // Vercel: project/team/edge-config IDs
    "vercel.com": [
      { key: "vercelProject", label: "Vercel Project", regex: /\bprj_[A-Za-z0-9]{22}\b/g },
      { key: "vercelTeam",    label: "Vercel Team",    regex: /\bteam_[A-Za-z0-9]{22}\b/g },
      { key: "vercelEdge",    label: "Vercel Edge Config", regex: /\becfg_[A-Za-z0-9]{22,}\b/g },
    ],
    // Netlify: site UUIDs and deploy hook tokens
    "app.netlify.com": [
      { key: "netlifyId",     label: "Netlify ID",     regex: /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi },
      { key: "netlifyHook",   label: "Netlify Hook",   regex: /api\.netlify\.com\/build_hooks\/[a-f0-9]{24}/g },
    ],
    // DigitalOcean: UUIDs are resource IDs, Spaces access keys
    "cloud.digitalocean.com": [
      { key: "doUuid",        label: "DO Resource ID", regex: /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi },
      { key: "doSpacesKey",   label: "DO Spaces Key",  regex: /\bDO[A-Z0-9]{16,20}\b/g },
    ],
    // Heroku: API keys are UUIDs, config var values visible in settings
    "dashboard.heroku.com": [
      { key: "herokuApiKey",  label: "Heroku API Key", regex: /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi },
    ],
    // Supabase: JWT anon/service keys only visible in dashboard
    "app.supabase.com": [
      { key: "supabaseJwt",   label: "Supabase Key",   regex: /\beyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g },
      { key: "supabaseUuid",  label: "Supabase ID",    regex: /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi },
    ],
    // MongoDB Atlas: 24-char ObjectIDs, UUID API keys
    "cloud.mongodb.com": [
      { key: "mongoObjectId", label: "Atlas Object ID", regex: /\b[a-f0-9]{24}\b/g },
      { key: "mongoUuid",     label: "Atlas API Key",   regex: /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi },
    ],
    // Datadog: 32-char API key, 40-char App key — too generic globally
    "app.datadoghq.com": [
      { key: "ddApiKey",      label: "DD API Key",      regex: /\b[a-f0-9]{32}\b/g },
      { key: "ddAppKey",      label: "DD App Key",      regex: /\b[a-f0-9]{40}\b/g },
      { key: "ddClientToken", label: "DD Client Token", regex: /\bpub[a-f0-9]{32}\b/g },
    ],
    // Sentry: old-format 64-hex auth tokens (too generic outside sentry.io)
    "sentry.io": [
      { key: "sentryOldToken", label: "Sentry Auth Token", regex: /\b[a-f0-9]{64}\b/g },
    ],
    // GitHub: .npmrc token lines sometimes visible in org settings
    "github.com": [
      { key: "githubNpmrc",   label: "npm auth token",  regex: /\/\/registry\.npmjs\.org\/:_authToken=[^\s"']+/g },
    ],
  };

  // ── Broad fallback patterns (run after all specific ones) ──────────────────

  const BUILTIN_PATTERNS = [
    { key: "ipv4",      label: "IPv4",        regex: /\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\b/g },
    { key: "ipv6",      label: "IPv6",        regex: /\b(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}\b|\b(?:[0-9a-fA-F]{1,4}:){1,7}:\b|\b::(?:[0-9a-fA-F]{1,4}:){0,6}[0-9a-fA-F]{1,4}\b/g },
    { key: "cfId",      label: "CF ID",       regex: /\b[0-9a-f]{32}\b/g },
    { key: "cfNs",      label: "Nameserver",  regex: /\b[a-z]{3,10}\d*\.ns\.cloudflare\.com\b/gi },
    { key: "apiToken",  label: "API Token",   regex: /\b[A-Za-z0-9_-]{40,}\b/g },
    { key: "email",     label: "Email",       regex: /\b[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}\b/g },
  ];

  // ── Active pattern list (rebuilt on init and on storage changes) ────────────

  let PATTERNS = [...BUILTIN_PATTERNS];

  function getDomainPatterns(hostname) {
    const rules = [];
    for (const [domain, patterns] of Object.entries(DOMAIN_RULES)) {
      if (hostname === domain || hostname.endsWith(`.${domain}`)) {
        rules.push(...patterns);
      }
    }
    return rules;
  }

  function rebuildPatterns(hostname, customRaw = []) {
    const domainSpecific = getDomainPatterns(hostname);
    const custom = (customRaw ?? []).flatMap((p) => {
      try { return [{ key: p.key, label: p.label, regex: new RegExp(p.pattern, "g") }]; }
      catch { return []; }
    });
    // Priority: domain-specific > global specific > builtin broad > user custom
    PATTERNS = [...domainSpecific, ...GLOBAL_PATTERNS, ...BUILTIN_PATTERNS, ...custom];
  }

  function buildPatternsFromStorage(rawList) {
    rebuildPatterns(domain, rawList);
  }

  // ─── Constants ─────────────────────────────────────────────────────────────

  const REDACT_CHAR   = "█";
  const REDACT_CLASS  = "tm-redacted";
  const HIDDEN_CLASS  = "tm-hidden";
  const BLURRED_CLASS = "tm-blurred";
  const CLICK_CURSOR_CLASS = "tm-click-mode";
  const OVERLAY_ID    = "tm-overlay";

  // ─── State ─────────────────────────────────────────────────────────────────

  let state = { enabled: false, clickHide: false, blurMode: false, pinned: false };
  const domain = location.hostname;

  // ─── Inject styles ─────────────────────────────────────────────────────────

  function injectStyles() {
    if (document.getElementById("tm-styles")) return;
    const style = document.createElement("style");
    style.id = "tm-styles";
    style.textContent = `
      .${REDACT_CLASS} {
        background: #1a1a1a !important;
        color: #1a1a1a !important;
        border-radius: 3px;
        padding: 0 2px;
        cursor: default;
        user-select: none;
        font-family: monospace;
        letter-spacing: -1px;
      }
      .${REDACT_CLASS}::after {
        content: attr(data-tm-label);
        display: inline-block;
        background: #2d2d2d;
        color: #888;
        font-size: 9px;
        font-family: monospace;
        padding: 0 4px;
        border-radius: 2px;
        vertical-align: middle;
        margin-left: 4px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      .${HIDDEN_CLASS} {
        visibility: hidden !important;
        pointer-events: none !important;
      }
      .${BLURRED_CLASS} {
        filter: blur(12px) !important;
        pointer-events: none !important;
        user-select: none !important;
      }
      body.${CLICK_CURSOR_CLASS} *:not(#${OVERLAY_ID}):not(#${OVERLAY_ID} *) {
        cursor: crosshair !important;
      }
      body.${CLICK_CURSOR_CLASS} *:not(#${OVERLAY_ID}):not(#${OVERLAY_ID} *):hover {
        outline: 2px solid #f97316 !important;
        outline-offset: 2px;
      }
      #${OVERLAY_ID} {
        position: fixed;
        top: 12px;
        right: 12px;
        z-index: 2147483647;
        background: rgba(17, 17, 17, 0.92);
        border: 1px solid #f97316;
        border-radius: 8px;
        padding: 8px 14px;
        font-family: monospace;
        font-size: 12px;
        color: #f97316;
        display: flex;
        align-items: center;
        gap: 8px;
        backdrop-filter: blur(6px);
        pointer-events: none;
        box-shadow: 0 4px 20px rgba(0,0,0,0.5);
      }
      #${OVERLAY_ID} .tm-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #f97316;
        animation: tm-pulse 1.5s infinite;
      }
      @keyframes tm-pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.3; }
      }
    `;
    document.head.appendChild(style);
  }

  // ─── Overlay indicator ─────────────────────────────────────────────────────

  function showOverlay(text) {
    let el = document.getElementById(OVERLAY_ID);
    if (!el) {
      el = document.createElement("div");
      el.id = OVERLAY_ID;
      document.body.appendChild(el);
    }
    el.innerHTML = `<div class="tm-dot"></div><span>${text}</span>`;
    el.style.display = "flex";
  }

  function hideOverlay() {
    const el = document.getElementById(OVERLAY_ID);
    if (el) el.style.display = "none";
  }

  function updateOverlay() {
    if (!state.enabled) return;
    if (state.clickHide) {
      const mode = state.blurMode ? "Blur" : "Hide";
      showOverlay(`TeachMode · Click-to-${mode} ON`);
    } else {
      showOverlay("TeachMode ON");
    }
  }

  // ─── Pattern helpers ───────────────────────────────────────────────────────

  function buildCombinedRegex() {
    const sources = PATTERNS.map((p) => {
      p.regex.lastIndex = 0;
      return `(?:${p.regex.source})`;
    });
    return new RegExp(sources.join("|"), "g");
  }

  function getMatchLabel(value) {
    for (const { label, regex } of PATTERNS) {
      regex.lastIndex = 0;
      if (regex.test(value)) {
        regex.lastIndex = 0;
        return label;
      }
    }
    return "REDACTED";
  }

  // ─── Text node redaction ────────────────────────────────────────────────────

  function redactTextNode(node) {
    const text = node.textContent;
    let hasMatch = false;

    for (const { regex } of PATTERNS) {
      regex.lastIndex = 0;
      if (regex.test(text)) { hasMatch = true; break; }
    }
    if (!hasMatch) return;

    const parent = node.parentNode;
    if (!parent || parent.classList?.contains(REDACT_CLASS)) return;

    const fragment = document.createDocumentFragment();
    const combined = buildCombinedRegex();
    let lastIndex = 0;
    let match;

    while ((match = combined.exec(text)) !== null) {
      if (match.index > lastIndex) {
        fragment.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
      }
      const span = document.createElement("span");
      span.className = REDACT_CLASS;
      span.setAttribute("data-tm-original", match[0]);
      span.setAttribute("data-tm-label", getMatchLabel(match[0]));
      span.textContent = REDACT_CHAR.repeat(Math.min(match[0].length, 12));
      fragment.appendChild(span);
      lastIndex = match.index + match[0].length;
    }

    if (lastIndex === 0) return;
    if (lastIndex < text.length) {
      fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
    }
    parent.replaceChild(fragment, node);
  }

  // ─── Walk and redact ────────────────────────────────────────────────────────

  const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA", "INPUT"]);

  function walkAndRedact(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const p = node.parentElement;
        if (!p) return NodeFilter.FILTER_REJECT;
        if (SKIP_TAGS.has(p.tagName)) return NodeFilter.FILTER_REJECT;
        if (p.classList?.contains(REDACT_CLASS)) return NodeFilter.FILTER_REJECT;
        if (p.closest(`[id="${OVERLAY_ID}"]`)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });

    const nodes = [];
    let node;
    while ((node = walker.nextNode())) nodes.push(node);
    nodes.forEach(redactTextNode);
  }

  function restoreRedacted() {
    document.querySelectorAll(`.${REDACT_CLASS}`).forEach((span) => {
      const original = span.getAttribute("data-tm-original");
      if (original) span.replaceWith(document.createTextNode(original));
    });
  }

  // ─── Click-to-hide / blur ──────────────────────────────────────────────────

  let hiddenElements = []; // stack for undo

  function applyHideClass(el) {
    const cls = state.blurMode ? BLURRED_CLASS : HIDDEN_CLASS;
    el.classList.add(cls);
    hiddenElements.push(el);
  }

  function removeHideClass(el) {
    el.classList.remove(HIDDEN_CLASS, BLURRED_CLASS);
    hiddenElements = hiddenElements.filter((h) => h !== el);
  }

  function restoreHidden() {
    hiddenElements.forEach((el) => el.classList.remove(HIDDEN_CLASS, BLURRED_CLASS));
    hiddenElements = [];
  }

  // ── Undo last hide ─────────────────────────────────────────────────────────

  function onUndoKey(e) {
    if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey && !e.altKey) {
      if (hiddenElements.length === 0) return;
      // Only intercept when click-hide is active to avoid conflicting with page undo
      if (!state.clickHide) return;
      e.preventDefault();
      e.stopPropagation();
      const el = hiddenElements.pop();
      if (document.contains(el)) {
        el.classList.remove(HIDDEN_CLASS, BLURRED_CLASS);
      }
    }
  }

  function enableClickHide() {
    document.body.classList.add(CLICK_CURSOR_CLASS);
    document.addEventListener("click", onClickHide, true);
    document.addEventListener("keydown", onUndoKey, true);
  }

  function disableClickHide() {
    document.body.classList.remove(CLICK_CURSOR_CLASS);
    document.removeEventListener("click", onClickHide, true);
    document.removeEventListener("keydown", onUndoKey, true);
  }

  function onClickHide(e) {
    if (e.target.id === OVERLAY_ID || e.target.closest(`#${OVERLAY_ID}`)) return;
    e.preventDefault();
    e.stopPropagation();

    const el = e.target;
    if (el.classList.contains(HIDDEN_CLASS) || el.classList.contains(BLURRED_CLASS)) {
      removeHideClass(el);
    } else {
      applyHideClass(el);
    }
  }

  // ─── Mutation observer ─────────────────────────────────────────────────────

  let observer = null;

  function startObserver() {
    if (observer) return;
    observer = new MutationObserver((mutations) => {
      if (!state.enabled) return;
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) walkAndRedact(node);
          else if (node.nodeType === Node.TEXT_NODE) redactTextNode(node);
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  function stopObserver() {
    observer?.disconnect();
    observer = null;
  }

  // ─── Apply / remove all censoring ──────────────────────────────────────────

  function applyAll() {
    injectStyles();
    walkAndRedact(document.body);
    startObserver();
    if (state.clickHide) enableClickHide();
    updateOverlay();
  }

  function removeAll() {
    stopObserver();
    restoreRedacted();
    restoreHidden();
    disableClickHide();
    hideOverlay();
  }

  // ─── State sync ────────────────────────────────────────────────────────────

  function applyState(newState) {
    const prev = state;
    state = { ...newState };

    if (!state.enabled) {
      removeAll();
      return;
    }

    if (!prev.enabled) {
      applyAll();
      return;
    }

    // clickHide toggled while enabled
    if (prev.clickHide !== state.clickHide) {
      if (state.clickHide) enableClickHide();
      else disableClickHide();
      updateOverlay();
    }

    // blurMode toggled — convert existing hidden/blurred elements to new style
    if (prev.blurMode !== state.blurMode) {
      hiddenElements.forEach((el) => {
        if (state.blurMode) {
          el.classList.remove(HIDDEN_CLASS);
          el.classList.add(BLURRED_CLASS);
        } else {
          el.classList.remove(BLURRED_CLASS);
          el.classList.add(HIDDEN_CLASS);
        }
      });
      updateOverlay();
    }
  }

  // ─── Custom patterns — live reload ─────────────────────────────────────────

  chrome.storage.onChanged.addListener((changes) => {
    if (!changes.custom_patterns) return;
    rebuildPatterns(domain, changes.custom_patterns.newValue);
    if (state.enabled) {
      restoreRedacted();
      walkAndRedact(document.body);
    }
  });

  // ─── Message listener ──────────────────────────────────────────────────────

  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === "SET_STATE") applyState(message.state);
  });

  // ─── Init ──────────────────────────────────────────────────────────────────

  async function init() {
    const stored = await chrome.storage.local.get("custom_patterns");
    rebuildPatterns(domain, stored.custom_patterns);

    chrome.runtime.sendMessage({ type: "GET_STATE", domain }, (response) => {
      if (response?.state) applyState(response.state);
    });
  }

  init();
})();
