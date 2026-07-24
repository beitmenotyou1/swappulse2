import moment from 'moment';

export function formatPrice(pence) {
  if (pence == null || isNaN(pence)) return '—';
  const pounds = pence / 100;
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 2,
  }).format(pounds);
}

export function timeAgo(date) {
  return moment(date).fromNow(true);
}

export function formatNumber(n) {
  if (n == null) return '0';
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return String(n);
}

export function initials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function conditionLabel(c) {
  return {
    mint: 'Mint',
    near_mint: 'Near Mint',
    excellent: 'Excellent',
    good: 'Good',
    damaged: 'Damaged',
  }[c] || c;
}

export function variantLabel(v) {
  return {
    normal: 'Normal',
    holo: 'Holo',
    reverse_holo: 'Reverse Holo',
  }[v] || v;
}

export const TRADE_STATUS_LABELS = {
  open: 'Open',
  negotiating: 'Negotiating',
  pending_ship: 'Pending Ship',
  completed: 'Completed',
  cancelled: 'Cancelled',
};