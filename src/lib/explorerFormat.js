// Formatting helpers for the PulseChain explorer UI.

export function truncateHash(hash, prefixLen = 10, suffixLen = 8) {
  if (!hash) return '';
  if (hash.length <= prefixLen + suffixLen + 2) return hash;
  return `${hash.slice(0, prefixLen)}…${hash.slice(-suffixLen)}`;
}

export function formatAge(timestamp) {
  if (!timestamp) return '';
  const now = Date.now();
  const then = new Date(timestamp).getTime();
  if (isNaN(then)) return '';
  const secs = Math.max(0, Math.floor((now - then) / 1000));
  if (secs < 60) return `${secs} sec${secs === 1 ? '' : 's'} ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins} min${mins === 1 ? '' : 's'} ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr${hrs === 1 ? '' : 's'} ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
  const months = Math.floor(days / 30);
  return `${months} mo${months === 1 ? '' : 's'} ago`;
}

export function formatTimestamp(timestamp) {
  if (!timestamp) return '';
  const d = new Date(timestamp);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'medium' });
}

// Convert a wei string to a PLS string with the given decimal precision.
export function formatPls(weiStr, decimals = 6) {
  if (!weiStr || weiStr === '0') return '0';
  try {
    const wei = BigInt(weiStr);
    const divisor = 10n ** 18n;
    const whole = wei / divisor;
    const fraction = wei % divisor;
    const fracStr = fraction.toString().padStart(18, '0').slice(0, decimals).replace(/0+$/, '');
    return fracStr ? `${whole.toString()}.${fracStr}` : whole.toString();
  } catch {
    return '0';
  }
}

export function formatGwei(weiStr) {
  if (!weiStr || weiStr === '0') return '0';
  try {
    const wei = BigInt(weiStr);
    const gwei = wei / 10n ** 9n;
    const rem = wei % 10n ** 9n;
    const frac = rem.toString().padStart(9, '0').slice(0, 2).replace(/0+$/, '');
    return frac ? `${gwei.toString()}.${frac}` : gwei.toString();
  } catch {
    return '0';
  }
}

export function formatNumber(num) {
  if (num == null || num === '') return '';
  try {
    return Number(num).toLocaleString('en-GB');
  } catch {
    return String(num);
  }
}

// Format a token amount from base units, given decimals.
export function formatTokenAmount(valueStr, decimals = 18, displayDecimals = 6) {
  if (!valueStr || valueStr === '0') return '0';
  try {
    const value = BigInt(valueStr);
    const divisor = 10n ** BigInt(decimals);
    const whole = value / divisor;
    const fraction = value % divisor;
    const fracStr = fraction.toString().padStart(Number(decimals), '0').slice(0, displayDecimals).replace(/0+$/, '');
    return fracStr ? `${whole.toString()}.${fracStr}` : whole.toString();
  } catch {
    return valueStr;
  }
}