// Background service worker for Profile Filler
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'GET_TAB') {
    chrome.tabs.query({ active: true, currentWindow: true }).then(tabs => {
      const tab = tabs[0] || {};
      sendResponse({ url: tab.url });
    });
    return true;
  }
});

// Optional: auto-inject on page navigation (redundant with manifest content_scripts, but helps on SPA-like page transitions)
chrome.webNavigation?.onHistoryStateUpdated?.addListener(async (details) => {
  if (details.frameId === 0 && details.url && details.url.includes('google.com/forms')) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId: details.tabId },
        files: ['content.js']
      });
    } catch (e) {}
  }
});

// Keep popup/extension icon in sync
chrome.runtime.onInstalled.addListener(async () => {
  const existing = await chrome.storage.local.get(['profile']);
  if (!existing.profile) {
    // Load default profile
    try {
      const resp = await fetch(chrome.runtime.getURL('default-profile.json'));
      const profile = await resp.json();
      await chrome.storage.local.set({ profile });
    } catch (e) {
      console.warn('Could not load default profile', e);
    }
  }
});
