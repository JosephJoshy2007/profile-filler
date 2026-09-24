// Popup script for Profile Filler extension
const HOST_DISABLED_KEY = '__profile_filler_disabled_sites__';
const FILLED_KEY = '__profile_filler_last_run__';
const WEBAPP_URL = 'https://josephjoshy2007.github.io/profile-filler/';

async function getTabUrl() {
  const tab = await chrome.runtime.sendMessage({ type: 'GET_TAB' });
  return tab && tab.url ? tab.url : '';
}

async function isCurrentSiteDisabled(url) {
  const list = await chrome.storage.local.get([HOST_DISABLED_KEY]);
  const arr = list[HOST_DISABLED_KEY] || [];
  try { return arr.includes(new URL(url).hostname); } catch (e) { return false; }
}

async function setSiteDisabled(url, disabled) {
  const list = await chrome.storage.local.get([HOST_DISABLED_KEY]);
  const arr = list[HOST_DISABLED_KEY] || [];
  const host = new URL(url).hostname;
  if (disabled && !arr.includes(host)) arr.push(host);
  if (!disabled) {
    const idx = arr.indexOf(host);
    if (idx >= 0) arr.splice(idx, 1);
  }
  await chrome.storage.local.set({ [HOST_DISABLED_KEY]: arr });
}

async function loadResults() {
  const d = await chrome.storage.local.get([FILLED_KEY]);
  const r = d[FILLED_KEY];
  if (!r) return null;
  const card = document.getElementById('resultsCard');
  const container = document.getElementById('results');
  if (!card || !container) return r;
  card.style.display = 'block';
  container.innerHTML = '';
  for (const item of r.results || []) {
    const row = document.createElement('div');
    row.className = 'row';
    const badge = `<span class="badge ${item.ok ? 'ok' : 'skip'}">${item.ok ? 'filled' : 'skipped'}</span>`;
    row.innerHTML = `<div class="lbl">${escapeHtml(item.key)}</div><div class="val">${escapeHtml(item.title)} ${badge}</div>`;
    container.appendChild(row);
  }
  return r;
}

function escapeHtml(s) {
  return (s || '').replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));
}

document.addEventListener('DOMContentLoaded', async () => {
  const url = await getTabUrl();
  const isFormPage = url.includes('docs.google.com/forms') || url.includes('forms.gle');
  const statusEl = document.getElementById('urlStatus');
  const stateEl = document.getElementById('siteState');
  const toggleBtn = document.getElementById('toggleSite');
  const reFillBtn = document.getElementById('reFill');
  const openWebAppBtn = document.getElementById('openWebApp');

  if (!isFormPage) {
    statusEl.textContent = 'Not a Google Form';
    stateEl.textContent = 'Open a Google Form to auto-fill your profile.';
    toggleBtn.disabled = true;
    reFillBtn.disabled = true;
    openWebAppBtn.disabled = true;
  } else {
    const disabled = await isCurrentSiteDisabled(url);
    statusEl.textContent = new URL(url).hostname;
    stateEl.textContent = disabled ? 'Profile Filling is disabled on this site.' : 'Profile Filling is active on this site.';
    toggleBtn.textContent = disabled ? 'Enable on this site' : 'Disable on this site';
    toggleBtn.onclick = async () => {
      const cur = await isCurrentSiteDisabled(url);
      await setSiteDisabled(url, !cur);
      location.reload();
    };
    reFillBtn.onclick = async () => {
      const tab = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab[0]) {
        await chrome.tabs.sendMessage(tab[0].id, { type: 'RE_FILL' });
        setTimeout(loadResults, 500);
      }
    };
    await loadResults();
  }

  if (openWebAppBtn) {
    openWebAppBtn.onclick = () => {
      chrome.tabs.create({ url: WEBAPP_URL });
    };
  }

  // Import from clipboard or file
  const importText = document.getElementById('importText');
  const importPasteBtn = document.getElementById('importPaste');
  const importFileInput = document.getElementById('importFile');
  const syncStatus = document.getElementById('syncStatus');

  function showSyncStatus(msg, isOk) {
    if (!syncStatus) return;
    syncStatus.textContent = msg;
    syncStatus.className = 'sync-status ' + (isOk ? 'ok' : 'err');
    setTimeout(() => { syncStatus.textContent = ''; syncStatus.className = ''; }, 3000);
  }

  async function importProfile(profile) {
    if (!profile || !profile.fields || !profile.matchers) {
      showSyncStatus('Invalid profile format', false);
      return false;
    }
    try {
      await chrome.storage.local.set({ profile });
      showSyncStatus(`Imported! ${Object.keys(profile.fields).length} fields, ${profile.matchers.length} matchers`, true);
      // Refresh results after import
      setTimeout(loadResults, 500);
      return true;
    } catch (e) {
      showSyncStatus('Import failed: ' + e.message, false);
      return false;
    }
  }

  if (importPasteBtn) {
    importPasteBtn.onclick = async () => {
      const text = importText.value.trim();
      if (!text) {
        showSyncStatus('Paste JSON first', false);
        return;
      }
      try {
        const profile = JSON.parse(text);
        await importProfile(profile);
      } catch (e) {
        showSyncStatus('Invalid JSON: ' + e.message, false);
      }
    };
  }

  if (importFileInput) {
    importFileInput.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const profile = JSON.parse(reader.result);
          await importProfile(profile);
        } catch (err) {
          showSyncStatus('Invalid JSON file', false);
        }
      };
      reader.readAsText(file);
    };
  }
});
