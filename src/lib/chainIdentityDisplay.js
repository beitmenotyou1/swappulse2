import { AlertCircle, CheckCircle2, Clock, RefreshCw, ShieldCheck } from 'lucide-react';

// Shared presentation for on-chain identity state. These constants were
// duplicated across the wallet and settings surfaces and had already drifted
// (a missing MERGED entry mislabelled a registered identity as "pending"), so
// every chain UI now reads the same map.

export const CHAIN_AUTHORITATIVE = ['REGISTERED', 'RECOVERED'];

export function isChainAuthoritative(statusValue) {
  return CHAIN_AUTHORITATIVE.includes(statusValue);
}

export function shortHex(value) {
  if (!value || value.length < 18) return value || '—';
  return `${value.slice(0, 10)}…${value.slice(-8)}`;
}

export const IDENTITY_STATUS_CONFIG = {
  REGISTERED: { label: 'Secured on chain', bgClass: 'bg-success/10', textClass: 'text-success', Icon: CheckCircle2 },
  RECOVERED: { label: 'Recovered', bgClass: 'bg-success/10', textClass: 'text-success', Icon: ShieldCheck },
  MERGED: { label: 'Merged into another identity', bgClass: 'bg-primary/10', textClass: 'text-primary', Icon: ShieldCheck },
  DEPLOYED: { label: 'Deployed, pending verification', bgClass: 'bg-primary/10', textClass: 'text-primary', Icon: Clock },
  PENDING: { label: 'Reservation pending', bgClass: 'bg-warning/10', textClass: 'text-warning', Icon: Clock },
  FAILED: { label: 'Setup failed', bgClass: 'bg-destructive/10', textClass: 'text-destructive', Icon: AlertCircle },
  RECOVERY_PENDING: { label: 'Recovery in progress', bgClass: 'bg-warning/10', textClass: 'text-warning', Icon: RefreshCw },
};

// An unknown status must never borrow another status's meaning — surface it
// literally instead of silently presenting it as a pending reservation.
export function identityStatusConfig(statusValue) {
  if (IDENTITY_STATUS_CONFIG[statusValue]) return IDENTITY_STATUS_CONFIG[statusValue];
  return {
    label: statusValue ? `Unrecognised status (${statusValue})` : 'No identity yet',
    bgClass: 'bg-secondary',
    textClass: 'text-muted-foreground',
    Icon: AlertCircle,
  };
}