// Increment CURRENT_AUTH_EPOCH to force all users to re-authenticate.
// Existing sessions with a mismatched epoch in localStorage are logged out.
export const CURRENT_AUTH_EPOCH = 2;
const STORAGE_KEY = 'swappulse_auth_epoch';

export function getStoredAuthEpoch() {
  return Number(localStorage.getItem(STORAGE_KEY)) || 0;
}

export function setStoredAuthEpoch(epoch) {
  localStorage.setItem(STORAGE_KEY, String(epoch));
}