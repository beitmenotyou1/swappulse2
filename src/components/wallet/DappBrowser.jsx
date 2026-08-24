import React, { useState } from 'react';
import { X, Shield, ExternalLink, Link2, Loader2, Wifi } from 'lucide-react';
import { useWalletConnect } from '@/hooks/useWalletConnect';

export default function DappBrowser({ dapp, walletAddress, onClose }) {
  const [showConnect, setShowConnect] = useState(false);
  const [wcUri, setWcUri] = useState('');
  const { pair, approve, reject, sessions, disconnect, pairing, pendingProposal, isConfigured } =
    useWalletConnect(walletAddress);

  const dappUrl = walletAddress && dapp.urlBuilder ? dapp.urlBuilder(walletAddress) : dapp.url;

  const handlePair = () => {
    if (!wcUri.trim()) return;
    pair(wcUri.trim());
    setWcUri('');
    setShowConnect(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      {/* Top bar */}
      <div className="flex items-center gap-2 border-b border-border bg-card px-3 py-2.5 pt-[env(safe-area-inset-top,20px)]">
        <button onClick={onClose} className="rounded-full p-1.5 hover:bg-secondary">
          <X className="h-5 w-5" />
        </button>
        <span className="text-lg">{dapp.logo}</span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold">{dapp.name}</p>
          <div className="flex items-center gap-1.5">
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-bold text-emerald-600">
              <Shield className="h-2.5 w-2.5" />
              Read-Only
            </span>
            {walletAddress && (
              <span className="font-mono text-[10px] text-muted-foreground">
                {walletAddress.slice(0, 6)}…{walletAddress.slice(-4)}
              </span>
            )}
          </div>
        </div>
        {isConfigured && (
          <button
            onClick={() => setShowConnect(!showConnect)}
            className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-bold hover:bg-secondary"
          >
            <Link2 className="h-3.5 w-3.5" />
            Connect
          </button>
        )}
        <a href={dappUrl} target="_blank" rel="noopener noreferrer" className="rounded-full p-1.5 hover:bg-secondary">
          <ExternalLink className="h-4 w-4" />
        </a>
      </div>

      {/* WalletConnect URI input */}
      {showConnect && (
        <div className="border-b border-border bg-secondary/50 p-3">
          <p className="mb-2 text-xs text-muted-foreground">
            Paste the WalletConnect URI from {dapp.name}&rsquo;s &ldquo;Connect Wallet&rdquo; dialog to connect in read-only mode.
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={wcUri}
              onChange={(e) => setWcUri(e.target.value)}
              placeholder="wc:..."
              className="flex-1 rounded-lg border border-border bg-card px-3 py-2 font-mono text-xs outline-none focus:border-primary"
            />
            <button
              onClick={handlePair}
              disabled={pairing || !wcUri.trim()}
              className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
            >
              {pairing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link2 className="h-3.5 w-3.5" />}
              Pair
            </button>
          </div>
          {sessions.length > 0 && (
            <div className="mt-2 space-y-1">
              {sessions.map((s) => (
                <div key={s.topic} className="flex items-center justify-between rounded bg-card px-2 py-1.5 text-xs">
                  <span className="flex items-center gap-1.5"><Wifi className="h-3 w-3 text-emerald-500" /> Connected</span>
                  <button onClick={() => disconnect(s.topic)} className="font-semibold text-destructive hover:underline">Disconnect</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Session proposal dialog */}
      {pendingProposal && (
        <div className="border-b border-primary/30 bg-primary/5 p-3">
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <p className="truncate text-sm font-bold">
                {pendingProposal.params?.proposer?.metadata?.name || 'dApp'} wants to connect
              </p>
              <p className="text-xs text-muted-foreground">Read-only access — view your wallet address and balances</p>
            </div>
            <div className="flex shrink-0 gap-2">
              <button onClick={() => reject(pendingProposal)} className="rounded-lg border border-border px-3 py-1.5 text-xs font-bold hover:bg-secondary">Reject</button>
              <button onClick={() => approve(pendingProposal)} className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-white">Approve</button>
            </div>
          </div>
        </div>
      )}

      {/* dApp iframe */}
      <div className="flex-1 overflow-hidden">
        <iframe
          src={dappUrl}
          title={dapp.name}
          className="h-full w-full border-0"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          referrerPolicy="no-referrer"
        />
      </div>
    </div>
  );
}