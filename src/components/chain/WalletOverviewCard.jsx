import React, { useCallback, useEffect, useState } from 'react';
import { ArrowDownToLine, ArrowUpRight, Blocks, Coins, Copy, ShieldCheck, WalletCards } from 'lucide-react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { useT } from '@/lib/i18n/I18nProvider';

const DECIMALS = 18n;

function formatAmount(baseUnits) {
  const raw = String(baseUnits || '0');
  if (!/^[0-9]+$/.test(raw)) return '0';
  const value = BigInt(raw);
  const scale = 10n ** DECIMALS;
  const whole = value / scale;
  const fraction = ((value % scale) * 10000n) / scale;
  if (fraction === 0n) return String(whole);
  return `${whole}.${String(fraction).padStart(4, '0').replace(/0+$/, '')}`;
}

function shortAddress(value) {
  const raw = String(value || '');
  if (raw.length <= 24) return raw;
  return `${raw.slice(0, 12)}…${raw.slice(-10)}`;
}

function ActionLink({ href, icon: Icon, label }) {
  return (
    <a
      href={href}
      className="flex min-h-16 flex-col items-center justify-center gap-1.5 rounded-2xl border border-border bg-background/75 px-2 py-2 text-center text-xs font-bold transition-colors hover:border-primary/40 hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      <span className="grid h-8 w-8 place-items-center rounded-full bg-primary/10 text-primary">
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      {label}
    </a>
  );
}

export default function WalletOverviewCard({ identity, network }) {
  const t = useT();
  const { toast } = useToast();
  const [balance, setBalance] = useState(null);

  const loadBalance = useCallback(async () => {
    if (!identity?.account_address) {
      setBalance(null);
      return;
    }
    try {
      const res = await base44.functions.invoke('faucet-claim', { action: 'status' });
      const data = res?.data || res || null;
      setBalance(data?.balance != null ? String(data.balance) : null);
    } catch {
      setBalance(null);
    }
  }, [identity?.account_address]);

  useEffect(() => { loadBalance(); }, [loadBalance]);

  const copyAddress = async () => {
    if (!identity?.account_address) return;
    try {
      await navigator.clipboard.writeText(identity.account_address);
      toast({ title: t('wallet.overview.addressCopied') });
    } catch {
      toast({ title: t('wallet.overview.copyAddress'), variant: 'destructive' });
    }
  };

  return (
    <section className="overflow-hidden rounded-3xl border border-border bg-card shadow-base" aria-labelledby="wallet-overview-heading">
      <div className="bg-gradient-to-br from-primary/15 via-card to-card p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-primary">
              <WalletCards className="h-4 w-4" aria-hidden="true" />
              {t('nav.chainWallet')}
            </div>
            <h2 id="wallet-overview-heading" className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
              {balance == null ? t('wallet.overview.balanceUnavailable') : `${formatAmount(balance)} SWPX`}
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">{t('wallet.overview.balance')}</p>
          </div>
          <div className="rounded-2xl border border-primary/20 bg-background/75 px-3 py-2 text-right">
            <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{t('wallet.overview.network')}</p>
            <p className="mt-0.5 text-xs font-black text-primary">{network?.network || identity?.network || 'SWAPPULSE_TESTNET'}</p>
          </div>
        </div>

        {identity?.account_address && (
          <div className="mt-5 rounded-2xl border border-border/80 bg-background/75 p-3">
            <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{t('wallet.overview.account')}</p>
            <div className="mt-1 flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate font-mono text-xs sm:text-sm" dir="ltr" title={identity.account_address}>
                {shortAddress(identity.account_address)}
              </code>
              <Link
                to={`/chain/address/${identity.account_address}`}
                className="rounded-lg p-2 text-primary hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                aria-label={t('wallet.overview.explorer')}
              >
                <Blocks className="h-4 w-4" aria-hidden="true" />
              </Link>
              <button
                type="button"
                onClick={copyAddress}
                className="rounded-lg p-2 hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                aria-label={t('wallet.overview.copyAddress')}
              >
                <Copy className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        )}

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <button
            type="button"
            onClick={copyAddress}
            disabled={!identity?.account_address}
            className="flex min-h-16 flex-col items-center justify-center gap-1.5 rounded-2xl border border-border bg-background/75 px-2 py-2 text-center text-xs font-bold transition-colors hover:border-primary/40 hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50"
          >
            <span className="grid h-8 w-8 place-items-center rounded-full bg-primary/10 text-primary"><ArrowDownToLine className="h-4 w-4" aria-hidden="true" /></span>
            {t('wallet.overview.receive')}
          </button>
          <ActionLink href="#wallet-funding" icon={Coins} label={t('wallet.overview.fund')} />
          <ActionLink href="#wallet-staking" icon={ShieldCheck} label={t('wallet.overview.stake')} />
          <ActionLink href="#wallet-bridge" icon={ArrowUpRight} label={t('wallet.overview.send')} />
        </div>

        <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">{t('wallet.overview.selfCustody')}</p>
      </div>
    </section>
  );
}
