import React, { useState } from 'react';
import { X, Copy, Check } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { SUPPORTED_CHAINS } from '@/lib/chains';

// Per-chain receive modal: tabs for each supported chain showing the user's
// address, QR code, and username alias as the human-readable name.
export default function ReceiveModal({ chainAddresses, username, onClose }) {
  const { toast } = useToast();
  const [activeChain, setActiveChain] = useState('polygon');
  const [copied, setCopied] = useState(false);

  const chain = SUPPORTED_CHAINS.find((c) => c.key === activeChain);
  const address = chainAddresses?.[activeChain] || chainAddresses?.evm || '';

  const copyAddress = () => {
    navigator.clipboard.writeText(address);
    setCopied(true);
    toast({ title: 'Address copied!' });
    setTimeout(() => setCopied(false), 2000);
  };

  const qrUrl = address
    ? `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(address)}`
    : '';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-elevated" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">Receive</h2>
          <button onClick={onClose} className="rounded-full p-1.5 hover:bg-secondary"><X className="h-5 w-5" /></button>
        </div>

        {/* Chain tabs */}
        <div className="mb-4 flex gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
          {SUPPORTED_CHAINS.map((c) => (
            <button
              key={c.key}
              onClick={() => { setActiveChain(c.key); setCopied(false); }}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold transition ${
                activeChain === c.key
                  ? 'bg-primary text-white'
                  : 'border border-border text-muted-foreground hover:bg-secondary'
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>

        {address ? (
          <div className="flex flex-col items-center gap-4">
            <div className="rounded-2xl border-2 border-primary/20 bg-primary/5 p-4">
              <img src={qrUrl} alt={`${chain?.name} address QR code`} className="h-48 w-48" />
            </div>
            <p className="text-xs text-muted-foreground">
              Send {chain?.nativeSymbol || 'funds'} on {chain?.name} to this address
            </p>
            {username && (
              <div className="w-full rounded-xl border border-primary/30 bg-primary/5 p-2 text-center">
                <p className="text-xs text-muted-foreground">Or send to your username</p>
                <p className="text-sm font-bold text-primary">@{username}</p>
              </div>
            )}
            <div className="w-full rounded-xl border border-border bg-secondary p-3">
              <p className="break-all font-mono text-xs">{address}</p>
            </div>
            <button
              onClick={copyAddress}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-bold text-white hover:bg-primary/90"
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? 'Copied!' : 'Copy Address'}
            </button>
          </div>
        ) : (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No {chain?.name} address available. Create a multi-chain wallet first.
          </p>
        )}
      </div>
    </div>
  );
}