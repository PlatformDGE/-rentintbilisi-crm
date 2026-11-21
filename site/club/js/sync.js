// Made with Claude (Anthropic) · © Homes in Georgia · Created by Irakli Kvirkvelia
// Shared inbox of the club: every visitor's registration and booking is also sent
// to a Google Sheet (apps-script/club-sync.gs), the operator gets a Telegram
// message, and the admin console loads all drivers from there by key.
//
// Paste the Apps Script web app URL (…/exec) below, or set window.CLUB_SYNC_URL
// before the module loads. Empty = off: data stays in the visitor's browser only.

const DEFAULT_URL = '';
export const SYNC_URL = (typeof window !== 'undefined' && window.CLUB_SYNC_URL) || DEFAULT_URL;
export const enabled = () => !!SYNC_URL;

const COLLECTIONS = ['clients', 'bookings'];

export function push(collection, record) {
  if (!SYNC_URL || !COLLECTIONS.includes(collection) || !record || record.demo || record.remote) return;
  const body = JSON.stringify({ collection, record });
  try {
    fetch(SYNC_URL, { method: 'POST', body, mode: 'no-cors', keepalive: true, headers: { 'Content-Type': 'text/plain' } }).catch(() => {});
  } catch { /* offline: the record stays local */ }
}

// Loads every driver and booking for the admin console (JSONP: Apps Script has no CORS).
export function pull(key) {
  return new Promise((resolve, reject) => {
    if (!SYNC_URL) { reject(new Error('off')); return; }
    const cb = 'clubSync' + Date.now().toString(36);
    const s = document.createElement('script');
    const done = () => { delete window[cb]; s.remove(); clearTimeout(timer); };
    const timer = setTimeout(() => { done(); reject(new Error('timeout')); }, 15000);
    window[cb] = res => { done(); res && res.ok ? resolve(res) : reject(new Error(res?.error || 'error')); };
    s.onerror = () => { done(); reject(new Error('network')); };
    s.src = `${SYNC_URL}?action=club&key=${encodeURIComponent(key)}&callback=${cb}`;
    document.head.append(s);
  });
}
