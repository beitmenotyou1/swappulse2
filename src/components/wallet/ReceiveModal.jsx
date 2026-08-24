import React, { useState } from 'react';
import { X, Copy, Check, QrCode } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

export default function ReceiveModal({ walletAddress, onClose }) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const copyAddress = () => {
    navigator.clipboard.writeText(walletAddress);
    setCopied(true);
    toast({ title: 'Address copied!' });
    setTimeout(() => setCopied(false), 2000);
  };

  // Generate a simple QR code URL using a public API
  const qrUrl = walletAddress
    ? `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(walletAddress)}`
    : '';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-elevated" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">Receive USDC</h2>
          <button onClick={onClose} className="rounded-full p-1.5 hover:bg-secondary"><X className="h-5 w-5" /></button>
        </div>

        {walletAddress ? (
          <div className="flex flex-col items-center gap-4">
            <div className="rounded-2xl border-2 border-primary/20 bg-primary/5 p-4">
              <img src={qrUrl} alt="Wallet address QR code" className="h-48 w-48" />
            </div>
            <p className="text-xs text-muted-foreground">Scan to send USDC on Polygon to this address</p>
            <div className="w-full rounded-xl border border-border bg-secondary p-3">
              <p className="break-all font-mono text-xs">{walletAddress}</p>
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
          <p className="py-8 text-center text-sm text-muted-foreground">No wallet address available.</p>
        )}
      </div>
    </div>
  );
}