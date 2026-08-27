import React from 'react';
import { Link } from 'react-router-dom';
import { Wallet, ExternalLink } from 'lucide-react';
import { useT } from '@/lib/i18n/I18nProvider';

// Two action chips that appear on every transaction row:
// 1. "View in wallet" — deep-links to the SwapPulse wallet activity tab.
// 2. "View on explorer" — deep-links to this explorer's transaction detail page.
export default function TxActionLinks({ txHash, walletUrl = '/wallet' }) {
  const t = useT();
  const explorerUrl = `/blockchain/tx/${txHash}`;
  return (
    <span className="inline-flex items-center gap-1">
      <Link
        to={walletUrl}
        className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-foreground transition-colors hover:bg-secondary"
        title={t('explorer.viewInWallet')}
      >
        <Wallet className="h-3 w-3" />
        <span className="hidden lg:inline">{t('explorer.wallet')}</span>
      </Link>
      <Link
        to={explorerUrl}
        className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-primary transition-colors hover:bg-primary/10"
        title={t('explorer.viewOnExplorer')}
      >
        <ExternalLink className="h-3 w-3" />
        <span className="hidden lg:inline">{t('explorer.explorer')}</span>
      </Link>
    </span>
  );
}