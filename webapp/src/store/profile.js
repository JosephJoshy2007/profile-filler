// Profile storage: read/write from localStorage with default fallback
const LS_KEY = 'profile_filler_profile';
let DEFAULT_PROFILE = null;

async function fetchDefaultProfile() {
  try {
    const resp = await fetch(new URL('../../shared/default-profile.json', import.meta.url).href);
    DEFAULT_PROFILE = await resp.json();
  } catch (e) {
    DEFAULT_PROFILE = { version: 1, updated_at: new Date().toISOString(), fields: {}, matchers: [] };
  }
}

export function loadProfile() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  if (!DEFAULT_PROFILE) fetchDefaultProfile();
  return DEFAULT_PROFILE ? JSON.parse(JSON.stringify(DEFAULT_PROFILE)) : { version: 1, fields: {}, matchers: [] };
}

export function saveProfile(profile) {
  profile.updated_at = new Date().toISOString();
  localStorage.setItem(LS_KEY, JSON.stringify(profile));
}

export function exportProfile(profile) {
  const blob = new Blob([JSON.stringify(profile, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'profile-filler-backup.json';
  a.click();
  URL.revokeObjectURL(url);
}

export async function copyProfileToClipboard(profile) {
  const json = JSON.stringify(profile, null, 2);
  try {
    await navigator.clipboard.writeText(json);
    return { success: true, message: 'Profile JSON copied to clipboard — paste it into the extension popup' };
  } catch (e) {
    // Fallback for non-HTTPS or older browsers
    const ta = document.createElement('textarea');
    ta.value = json;
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
      document.body.removeChild(ta);
      return { success: true, message: 'Profile JSON copied to clipboard' };
    } catch (e2) {
      document.body.removeChild(ta);
      return { success: false, message: 'Copy failed — use the Export JSON button instead' };
    }
  }
}

export function getProfileJSON(profile) {
  return JSON.stringify(profile, null, 2);
}

export function importProfile(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      try { resolve(JSON.parse(reader.result)); }
      catch (e) { resolve(null); }
    };
    reader.readAsText(file);
  });
}

export function importProfileFromText(text) {
  try { return JSON.parse(text); }
  catch (e) { return null; }
}
