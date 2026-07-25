// Shared constants + helpers for the account-activation backend functions.
// §2.x activation lifecycle: 48h link validity, 7-day warning, 90-day deletion.

export const HOURS_48 = 48 * 60 * 60 * 1000;
export const THROTTLE_MS = 5 * 60 * 1000; // min gap between activation emails per account
export const DAY = 24 * 60 * 60 * 1000;
export const WARN_AFTER_DAYS = 7;
export const DELETE_AFTER_DAYS = 90;
export const REWARN_INTERVAL_DAYS = 7; // re-warn at most once per week

export function randomToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}