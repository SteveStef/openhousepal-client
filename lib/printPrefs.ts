// Open House kit print choices - whatever the agent picked last time is already set the next time
// (Documents window, full preview, the create wizard and Setup's "Your open house defaults" all share
// these). Saved to the ACCOUNT (users.setup_state["kit_prefs"] via /setup/kit-prefs) so another
// computer or phone starts the same way; localStorage keeps a copy so reads stay instant.
import api from '@/lib/api-service';
export const PRINT_PREFS = {
  // Sign-In flyer: agent photo/name/brokerage pill over the photo.
  flyerBrand: { key: 'ohp:flyerBrand', fallback: true },
  // On-screen Sign-In Sheet/Kiosk theme for NEW open houses (each open house also stores its own).
  qrDark: { key: 'ohp:qrDark', fallback: true },
  // Similar Homes: "X% Match" badges.
  matchScore: { key: 'ohp:matchScore', fallback: true },
  // Cheat Sheet: AI "Highlights of ..." recap in place of the full MLS description.
  recap: { key: 'ohp:recap', fallback: true },
  // Brag Sheet: the Sold / Volume / Avg stats row.
  bragStats: { key: 'ohp:bragStats', fallback: true },
} as const;

export type PrintPref = keyof typeof PRINT_PREFS;

export function readPrintPref(pref: PrintPref): boolean {
  const { key, fallback } = PRINT_PREFS[pref];
  try {
    const value = localStorage.getItem(key);
    return value == null ? fallback : value === '1';
  } catch {
    return fallback;
  }
}

function storedPrefs(): Partial<Record<PrintPref, boolean>> {
  const out: Partial<Record<PrintPref, boolean>> = {};
  try {
    (Object.keys(PRINT_PREFS) as PrintPref[]).forEach(pref => {
      const v = localStorage.getItem(PRINT_PREFS[pref].key);
      if (v != null) out[pref] = v === '1';
    });
  } catch {}
  return out;
}

// Changes go up to the account in one small batch (a few taps in a row = one save).
let pending: Partial<Record<PrintPref, boolean>> = {};
let flushTimer: ReturnType<typeof setTimeout> | null = null;
function queueSave(pref: PrintPref, on: boolean) {
  pending[pref] = on;
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(() => {
    const batch = pending as Record<string, boolean>;
    pending = {};
    flushTimer = null;
    api.setup.setKitPrefs(batch).catch(() => {});
  }, 400);
}

export function writePrintPref(pref: PrintPref, on: boolean) {
  try { localStorage.setItem(PRINT_PREFS[pref].key, on ? '1' : '0'); } catch {}
  queueSave(pref, on);
}

let syncing: Promise<Record<PrintPref, boolean>> | null = null;
/** Pulls the account's saved choices into this device (once per page load; `force` re-reads).
 *  An account with nothing saved yet takes this device's earlier choices, so nobody loses them. */
export function syncPrintPrefs(force = false): Promise<Record<PrintPref, boolean>> {
  const all = () => Object.fromEntries((Object.keys(PRINT_PREFS) as PrintPref[]).map(p => [p, readPrintPref(p)])) as Record<PrintPref, boolean>;
  if (syncing && !force) return syncing;
  syncing = api.setup.kitPrefs().then(r => {
    if (!r.success || !r.data) return all();
    const account = r.data.prefs || {};
    if (Object.keys(account).length === 0) {
      const local = storedPrefs();
      if (Object.keys(local).length) api.setup.setKitPrefs(local as Record<string, boolean>).catch(() => {});
      return all();
    }
    try {
      (Object.keys(PRINT_PREFS) as PrintPref[]).forEach(pref => {
        if (typeof account[pref] === 'boolean' && !(pref in pending)) localStorage.setItem(PRINT_PREFS[pref].key, account[pref] ? '1' : '0');
      });
    } catch {}
    return all();
  }).catch(() => all());
  return syncing;
}
