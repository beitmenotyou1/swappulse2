import React, { useCallback, useEffect, useState } from 'react';
import { Coins, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { useT } from '@/lib/i18n/I18nProvider';

// Testnet SWPX faucet. Eligibility, the fixed drip amount, and the 24h cooldown are
// all decided by the backend — this card only renders what it is told and asks for
// a claim.

const DECIMALS = 18n;

function formatAmount(baseUnits) {
  const raw = String(baseUnits || '0');
  if (!/^[0-9]+$/.test(raw)) return '0';
  const value = BigInt(raw);
  const whole = value / 10n ** DECIMALS;
  const fraction = ((value % 10n ** DECIMALS) * 100n) / 10n ** DECIMALS;
  return fraction > 0n ? `${whole}.${String(fraction).padStart(2, '0')}` : String(whole);
}

function formatCooldown(ms) {
  const totalMinutes = Math.ceil(Number(ms || 0) / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

export default function FaucetCard() {
  const t = useT();
  const { toast } = useToast();
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke('faucet-claim', { action: 'status' });
      setStatus(res?.data || res || null);
    } catch {
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const claim = async () => {
    setClaiming(true);
    try {
      const res = await base44.functions.invoke('faucet-claim', { action: 'claim' });
      const data = res?.data || res;
      toast({
        title: t('faucet.claimed'),
        description: t('faucet.claimedDescription').replace('{amount}', formatAmount(data?.amount)),
      });
      await load();
    } catch (error) {
      toast({
        title: t('faucet.claimFailed'),
        description: error?.response?.data?.error || error?.message || t('faucet.claimFailed'),
        variant: 'destructive',
      });
    } finally {
      setClaiming(false);
    }
  };

  const reasonKey = {
    AGE_ELIGIBILITY_REQUIRED: 'faucet.reason.age',
    IDENTITY_NOT_SECURED: 'faucet.reason.identity',
    CHAIN_VERIFICATION_REQUIRED: 'faucet.reason.network',
    NATIVE_TOKEN_NOT_VERIFIED: 'faucet.reason.network',
    COOLDOWN_ACTIVE: 'faucet.reason.cooldown',
  }[status?.reason];

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex items-start gap-3">
        <div className="rounded-full bg-accent/15 p-2.5">
          <Coins className="h-5 w-5 text-accent" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold">{t('faucet.title')}</p>
          <p className="text-xs text-muted-foreground">{t('faucet.subtitle')}</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
      ) : !status ? (
        <p className="text-xs text-muted-foreground">{t('faucet.unavailable')}</p>
      ) : (
        <>
          <div className="mb-3 rounded-lg bg-secondary/60 p-3">
            <p className="text-xs text-muted-foreground">{t('faucet.balance')}</p>
            <p className="font-mono text-lg font-bold">{formatAmount(status.balance)} SWPX</p>
          </div>

          {reasonKey && (
            <p className="mb-3 text-xs text-muted-foreground">
              {status.reason === 'COOLDOWN_ACTIVE'
                ? t('faucet.reason.cooldown').replace('{time}', formatCooldown(status.cooldown_ms_remaining))
                : t(reasonKey)}
            </p>
          )}

          <Button onClick={claim} disabled={!status.eligible || claiming} className="w-full">
            {claiming ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Coins className="mr-2 h-4 w-4" />}
            {t('faucet.claim')}
          </Button>
        </>
      )}
    </div>
  );
}