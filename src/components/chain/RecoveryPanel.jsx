import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, KeyRound, Loader2, ShieldCheck, Timer } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/lib/AuthContext';
import { resetDeviceTestSigner } from '@/lib/testnetSignerVault';
import { useT } from '@/lib/i18n/I18nProvider';

// Recovery is a two-stage, deliberately slow flow: propose a new device key, wait
// out the on-chain delay, then execute. The waiting period is what protects the
// true owner, so the countdown is the centre of this UI.

function remainingLabel(iso) {
  const at = Date.parse(String(iso || ''));
  if (!Number.isFinite(at)) return '';
  const ms = Math.max(0, at - Date.now());
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

export default function RecoveryPanel({ stepUpToken, onLock }) {
  const t = useT();
  const { user } = useAuth();
  const { toast } = useToast();
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke('chain-recovery', { action: 'status' });
      setState(res?.data || res || null);
    } catch (error) {
      setState({ error: error?.response?.data?.error || error?.message || t('recovery.loadFailed') });
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { load(); }, [load]);

  const act = async (action, extra = {}) => {
    setBusy(action);
    try {
      const res = await base44.functions.invoke('chain-recovery', { action, step_up_token: stepUpToken, ...extra });
      const data = res?.data || res;
      toast({ title: t(`recovery.done.${action}`) });
      setState((prev) => ({ ...prev, recovery: data?.recovery || prev?.recovery }));
      await load();
    } catch (error) {
      if (error?.response?.status === 403 && onLock) onLock();
      toast({
        title: t('recovery.actionFailed'),
        description: error?.response?.data?.error || error?.message || '',
        variant: 'destructive',
      });
    } finally {
      setBusy('');
    }
  };

  const propose = async () => {
    setBusy('propose');
    try {
      // A recovering collector's browser holds no usable key (or the wrong one),
      // so a fresh device signer is generated here and only its PUBLIC key is sent.
      const signer = await resetDeviceTestSigner(user?.id);
      await act('propose', { new_public_key: signer.publicKey });
    } catch (error) {
      toast({ title: t('recovery.actionFailed'), description: error?.message || '', variant: 'destructive' });
      setBusy('');
    }
  };

  if (loading) {
    return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  if (!state || state.error) {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-border bg-card p-4">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
        <p className="text-sm text-muted-foreground">{state?.error || t('recovery.noIdentity')}</p>
      </div>
    );
  }

  const recovery = state.recovery || {};

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-4">
        <p className="text-xs uppercase text-muted-foreground">{t('recovery.account')}</p>
        <p className="break-all font-mono text-sm">{state.identity?.account_address}</p>
        <p className="mt-2 text-xs text-muted-foreground">
          {t('recovery.delay').replace('{hours}', String(Math.round(Number(recovery.recovery_delay_seconds || 0) / 3600)))}
        </p>
      </div>

      {recovery.pending ? (
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
          <div className="mb-2 flex items-center gap-2">
            <Timer className="h-5 w-5 text-primary" />
            <p className="font-bold">{recovery.ready ? t('recovery.readyTitle') : t('recovery.pendingTitle')}</p>
          </div>
          <p className="mb-3 text-sm text-muted-foreground">
            {recovery.ready
              ? t('recovery.readyBody')
              : t('recovery.pendingBody').replace('{time}', remainingLabel(recovery.execute_after_iso))}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => act('execute')} disabled={!recovery.ready || !!busy}>
              {busy === 'execute' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
              {t('recovery.complete')}
            </Button>
            <Button variant="outline" onClick={() => act('cancel')} disabled={!!busy}>
              {t('recovery.cancel')}
            </Button>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="mb-3 text-sm text-muted-foreground">{t('recovery.startBody')}</p>
          <Button onClick={propose} disabled={!!busy}>
            {busy === 'propose' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}
            {t('recovery.start')}
          </Button>
        </div>
      )}
    </div>
  );
}