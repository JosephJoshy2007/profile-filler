// Profile Filler content script — runs on Google Forms pages
(function() {
  'use strict';

  const FILLED_KEY = '__profile_filler_last_run__';
  const HOST_DISABLED_KEY = '__profile_filler_disabled_sites__';

  // ---------- storage helpers ----------
  async function getProfile() {
    const d = await chrome.storage.local.get(['profile']);
    return d.profile || { fields: {}, matchers: [] };
  }
  async function isHostDisabled() {
    try {
      const tab = await chrome.runtime.sendMessage({ type: 'GET_TAB' });
      const url = tab && tab.url ? new URL(tab.url) : null;
      if (!url) return false;
      const list = await chrome.storage.local.get([HOST_DISABLED_KEY]);
      const arr = list[HOST_DISABLED_KEY] || [];
      return arr.includes(url.hostname);
    } catch (e) { return false; }
  }
  async function recordFillResult(results) {
    try {
      await chrome.storage.local.set({ [FILLED_KEY]: { ts: Date.now(), url: location.href, results } });
    } catch (e) {}
  }

  // ---------- field detection ----------
  // Google Forms DOM structure (2025):
  //   - Question container: div[role="listitem"]
  //   - Title: [data-params] inner text, or .freebirdFormviewerComponentsQuestionBaseTitle
  //   - Inputs: input[type=text], input[type=email], input[type=url], input[type=tel], textarea
  //   - Radio: div[role="radio"] inside div[role="radiogroup"]
  //   - Checkbox: div[role="checkbox"]
  //   - Select (dropdown): not common in GF, but: [role="listbox"] options or native select
  //   - Date: input[type=date]

  function getQuestionRoots() {
    return Array.from(document.querySelectorAll('div[role="listitem"]'));
  }

  function getTitle(root) {
    // Try multiple selectors
    const sels = [
      '[data-params]',
      '.freebirdFormviewerComponentsQuestionBaseTitle',
      '.freebirdCustomFontEl',
      '[jsname="wzEDJd"]',
      'div[aria-label]'
    ];
    for (const sel of sels) {
      const el = root.querySelector(sel);
      if (el) {
        const text = (el.innerText || el.textContent || '').trim();
        if (text) return text;
      }
    }
    // Fallback: first non-empty text node
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let n;
    while (n = walker.nextNode()) {
      const t = n.textContent.trim();
      if (t.length > 0 && !t.match(/^\d+\s*of\s*\d+$/)) return t;
    }
    return '';
  }

  function getFieldKind(root) {
    if (root.querySelector('input[type="text"], input[type="email"], input[type="url"], input[type="tel"], textarea'))
      return 'text';
    if (root.querySelector('input[type="date"]'))
      return 'date';
    if (root.querySelector('input[type="number"]'))
      return 'number';
    if (root.querySelector('div[role="radiogroup"]'))
      return 'single_choice';
    if (root.querySelectorAll('div[role="checkbox"]').length > 1)
      return 'multi_choice';
    if (root.querySelector('select, [role="listbox"]'))
      return 'dropdown';
    return 'unknown';
  }

  // ---------- matching ----------
  function normalize(s) {
    return (s || '').toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
  }

  function levenshtein(a, b) {
    if (!a) return b ? b.length : 0;
    if (!b) return a.length;
    const m = a.length, n = b.length;
    const dp = Array.from({length: m + 1}, () => Array(n + 1).fill(0));
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++)
      for (let j = 1; j <= n; j++)
        dp[i][j] = Math.min(dp[i-1][j]+1, dp[i][j-1]+1, dp[i-1][j-1] + (a[i-1]===b[j-1]?0:1));
    return dp[m][n];
  }

  function matchScore(label, patterns, type) {
    const L = normalize(label);
    if (!L) return 0;
    let best = 0;
    for (const raw of patterns) {
      const p = normalize(raw);
      if (!p) continue;
      let s = 0;
      if (type === 'exact' || type === undefined) {
        s = L === p ? 1 : 0;
      } else if (type === 'substring') {
        s = L.includes(p) ? 0.95 : (p.includes(L) && L.length >= 4 ? 0.85 : 0);
      } else if (type === 'fuzzy') {
        const dist = levenshtein(L, p);
        const max = Math.max(L.length, p.length);
        s = max > 0 ? 1 - dist / max : 0;
      } else if (type === 'regex') {
        try { s = new RegExp(p, 'i').test(label) ? 0.9 : 0; } catch (e) { s = 0; }
      }
      best = Math.max(best, s);
    }
    return best;
  }

  // ---------- filling ----------
  function setInputValue(el, val) {
    el.focus();
    el.value = val;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.blur();
  }

  function fillText(root, profileField) {
    const el = root.querySelector('input[type="text"], input[type="email"], input[type="url"], input[type="tel"], textarea');
    if (!el) return false;
    const v = profileField.value;
    if (v === '' || v == null) return false;
    setInputValue(el, String(v));
    return true;
  }

  function fillDate(root, profileField) {
    const el = root.querySelector('input[type="date"]');
    if (!el) return false;
    const v = profileField.value;
    if (!v) return false;
    setInputValue(el, v);
    return true;
  }

  function fillNumber(root, profileField) {
    const el = root.querySelector('input[type="number"]');
    if (!el) return false;
    const v = profileField.value;
    if (v === '' || v == null) return false;
    setInputValue(el, String(v));
    return true;
  }

  function fillSingleChoice(root, profileField) {
    const group = root.querySelector('div[role="radiogroup"]');
    if (!group) return false;
    const radios = Array.from(group.querySelectorAll('div[role="radio"]'));
    if (!radios.length) return false;
    const target = normalize(String(profileField.value || ''));
    if (!target) return false;
    // Match against radio's text label (first child usually)
    const scores = radios.map(r => {
      const label = normalize(r.innerText || r.textContent || '');
      let s = label === target ? 1 : 0;
      if (!s && label.includes(target)) s = 0.9;
      if (!s && target.includes(label)) s = 0.85;
      // Also match against the option's value attribute if present
      const val = normalize(r.getAttribute('aria-label') || '');
      if (val === target) s = Math.max(s, 1);
      return { r, s };
    });
    scores.sort((a, b) => b.s - a.s);
    if (scores[0].s < 0.7) return false;
    // Simulate click
    scores[0].r.click();
    return true;
  }

  function fillMultiChoice(root, profileField) {
    const checkboxes = Array.from(root.querySelectorAll('div[role="checkbox"]'));
    if (!checkboxes.length) return false;
    const values = Array.isArray(profileField.value) ? profileField.value : [];
    if (!values.length) return false;
    let filled = 0;
    for (const target of values) {
      const t = normalize(String(target));
      const scores = checkboxes.map(c => {
        const label = normalize(c.innerText || c.textContent || '');
        let s = label === t ? 1 : 0;
        if (!s && label.includes(t)) s = 0.9;
        if (!s && t.includes(label)) s = 0.85;
        return { c, s };
      });
      scores.sort((a, b) => b.s - a.s);
      if (scores[0].s >= 0.7) {
        scores[0].c.click();
        filled++;
      }
    }
    return filled > 0;
  }

  function fillDropdown(root, profileField) {
    // Native select
    let sel = root.querySelector('select');
    if (sel) {
      const target = normalize(String(profileField.value || ''));
      const opts = Array.from(sel.options);
      const scores = opts.map(o => {
        const label = normalize(o.textContent || '');
        let s = label === target ? 1 : 0;
        if (!s && label.includes(target)) s = 0.9;
        return { o, s };
      });
      scores.sort((a, b) => b.s - a.s);
      if (scores[0].s >= 0.7) {
        sel.value = scores[0].o.value;
        sel.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      }
      return false;
    }
    // ARIA listbox (rare in GF but possible)
    const trigger = root.querySelector('[role="listbox"]');
    if (trigger) {
      // Not robustly supported; skip for now
      return false;
    }
    return false;
  }

  // ---------- main fill pass ----------
  async function fillAll() {
    const profile = await getProfile();
    const roots = getQuestionRoots();
    const results = [];
    for (const root of roots) {
      const title = getTitle(root);
      const kind = getFieldKind(root);
      if (!title || kind === 'unknown') continue;

      // Find best-matching profile field
      let bestMatcher = null, bestScore = 0;
      for (const m of profile.matchers) {
        if (m.enabled === false) continue;
        const score = matchScore(title, m.label_patterns, m.match_type);
        if (score > bestScore) { bestScore = score; bestMatcher = m; }
      }
      if (!bestScore || bestScore < 0.6) continue;

      const field = profile.fields[bestMatcher.field_key];
      if (!field || field.value === '' || field.value == null) continue;

      // Check kind compatibility
      let ok = false;
      if ((kind === 'text' || kind === 'date' || kind === 'number') && ['text','single_choice','multi_choice','number','date'].includes(field.type)) {
        if (kind === 'text' && field.type === 'text') ok = fillText(root, field);
        else if (kind === 'date' && field.type === 'date') ok = fillDate(root, field);
        else if (kind === 'number' && field.type === 'number') ok = fillNumber(root, field);
        else if (kind === 'text' && field.type === 'single_choice') ok = fillSingleChoice(root, field);
        else if (kind === 'text' && field.type === 'multi_choice') ok = fillMultiChoice(root, field);
      } else if (kind === 'single_choice' && field.type === 'single_choice') {
        ok = fillSingleChoice(root, field);
      } else if (kind === 'multi_choice' && field.type === 'multi_choice') {
        ok = fillMultiChoice(root, field);
      } else if (kind === 'dropdown') {
        ok = fillDropdown(root, field);
      }
      results.push({ title, key: bestMatcher.field_key, score: bestScore, ok });
    }
    recordFillResult(results);
  }

  // ---------- multi-page handling ----------
  let lastUrl = location.href;
  let observer = null;

  function startObserver() {
    observer = new MutationObserver(() => {
      // New questions may have appeared (next page loaded)
      setTimeout(() => fillAll(), 300);
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  // Initial fill
  async function init() {
    if (await isHostDisabled()) return;
    await fillAll();
    startObserver();
  }

  // Also listen for messages from popup (manual trigger)
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === 'RE_FILL') { fillAll().then(sendResponse); return true; }
    if (msg.type === 'GET_RESULTS') {
      chrome.storage.local.get([FILLED_KEY]).then(sendResponse);
      return true;
    }
  });

  init();
})();
