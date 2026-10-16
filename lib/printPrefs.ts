// Open House kit print choices, remembered per device - whatever the agent picked last time is
// already set the next time (Documents window, full preview, and the create wizard all share these).
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

export function writePrintPref(pref: PrintPref, on: boolean) {
  try { localStorage.setItem(PRINT_PREFS[pref].key, on ? '1' : '0'); } catch {}
}
