// Have I Been Pwned breached-password check (§3.4).
// k-anonymity: only the first 5 chars of the SHA-1 hash are sent to the API;
// the rest is compared locally. On any failure (network, CORS, etc.) we
// resolve to null (non-blocking) so account creation/reset is never blocked.
const HIBP_ENDPOINT = "https://api.pwnedpasswords.com/range/";

async function sha1Hex(text) {
  const buf = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}

// Returns the breach count for the password, or null if the check could not
// complete (treated as "not found" — never blocks the caller).
export async function checkPasswordBreach(password) {
  if (!password) return null;
  try {
    const hash = await sha1Hex(password);
    const prefix = hash.slice(0, 5);
    const suffix = hash.slice(5);
    const res = await fetch(`${HIBP_ENDPOINT}${prefix}`);
    if (!res.ok) return null;
    const body = await res.text();
    for (const line of body.split("\n")) {
      const [s, count] = line.trim().split(":");
      if (s === suffix) return Number(count) || 1;
    }
    return 0;
  } catch {
    return null;
  }
}

export const BREACH_WARNING = "This password has appeared in a known data breach. Please choose a different password for your safety.";