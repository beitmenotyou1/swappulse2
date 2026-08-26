import React, { useState } from 'react';
import { Wallet, Copy, Check, ExternalLink, Fingerprint, KeyRound, Eye } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import SeedPhraseModal from './SeedPhraseModal';
import SeedPhraseViewerModal from './SeedPhraseViewerModal';

// Shows the user's custodial wallet address, security status, and management
// actions: view seed phrase (via unified verification modal), add passkey,
// set PIN.
export default function CustodialWalletCard({ wallet, onUpdated }) {
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);
  const [showSeedViewer, setShowSeedViewer] = useState(false);
  const [showSeed, setShowSeed] = useState(false);
  const [mnemonic, setMnemonic] = useState('');

  const handleCopy = () => {
    navigator.clipboard.writeText(wallet.wallet_address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
      <div className="flex items-center gap-2">
        <Wallet className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-bold">Your SwapPulse Wallet</h3>
        <span className="ml-auto flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-bold text-success">
          <Check className="h-3 w-3" /> ACTIVE
        </span>
      </div>

      <div className="mt-3 flex items-center gap-2 rounded-lg bg-card px-3 py-2">
        <span className="truncate font-mono text-xs">{wallet.wallet_address}</span>
        <button
          onClick={handleCopy}
          className="ml-auto shrink-0 text-muted-foreground hover:text-foreground"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
        </button>
      </div>

      {/* Security status */}
      <div className="mt-3 flex flex-wrap gap-2">
        {wallet.has_passkey && (
          <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2.5 py-1 text-[10px] font-bold text-success">
            <Fingerprint className="h-3 w-3" /> Passkey Protected
          </span>
        )}
        {wallet.has_pin && (
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-bold text-primary">
            <KeyRound className="h-3 w-3" /> PIN Protected
          </span>
        )}
        {!wallet.has_passkey && !wallet.has_pin && (
          <span className="inline-flex items-center gap-1 rounded-full bg-warning/10 px-2.5 py-1 text-[10px] font-bold text-warning">
            <KeyRound className="h-3 w-3" /> No Lock — Add a Passkey
          </span>
        )}
      </div>

      {/* Actions */}
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          onClick={() => setShowSeedViewer(true)}
          className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold hover:bg-secondary"
        >
          <Eye className="h-3.5 w-3.5" />
          View Seed Phrase
        </button>
        <a
          href={`https://polygonscan.com/address/${wallet.wallet_address}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold hover:bg-secondary"
        >
          <ExternalLink className="h-3.5 w-3.5" /> Polygonscan
        </a>
      </div>

      {showSeedViewer && (
        <SeedPhraseViewerModal
          wallet={wallet}
          open={true}
          onClose={() => setShowSeedViewer(false)}
          onSuccess={(m) => { setMnemonic(m); setShowSeed(true); }}
        />
      )}

      {showSeed && (
        <SeedPhraseModal
          open={true}
          mnemonic={mnemonic}
          title="Your Recovery Phrase"
          onClose={() => { setShowSeed(false); setMnemonic(''); }}
        />
      )}
    </div>
  );
}