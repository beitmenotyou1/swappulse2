import React, { useState, useEffect } from 'react';
import { Loader2, Fingerprint, Check, ExternalLink } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useToast } from '@/components/ui/use-toast';

export default function UsernameMintCard({ walletLinked }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [asset, setAsset] = useState(null);
  const [loading, setLoading] = useState(true);
  const [minting, setMinting] = useState(false);

  const load = async () => {
    if (!user?.did) { setLoading(false); return; }
    try {
      const res = await base44.functions.invoke('get-on-chain-assets', { did: user.did, assetType: 'username' });
      setAsset(res.data.assets[0] || null);
    } catch { setAsset(null); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [user?.did]);

  const handleMint = async () => {
    setMinting(true);
    try {
      const res = await base44.functions.invoke('mint-username', {});
      setAsset(res.data.asset);
      toast({ title: 'Username minted on Polygon!', description: 'Your handle is now permanently on-chain.' });
    } catch (e) {
      const msg = e?.response?.data?.error || e.message;
      toast({ title: 'Mint failed', description: msg, variant: 'destructive' });
    } finally {
      setMinting(false);
    }
  };

  if (loading) return null;

  if (asset) {
    return (
      <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
        <div className="flex items-center gap-2">
          <Fingerprint className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-bold">On-Chain Username</h3>
          <span className="ml-auto flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-bold text-success">
            <Check className="h-3 w-3" /> MINTED
          </span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Your handle <span className="font-semibold text-foreground">@{asset.handle}</span> is permanently minted as a soulbound NFT.
        </p>
        <div className="mt-2 text-xs font-mono text-muted-foreground">
          Token #{asset.token_id} · {asset.contract_address?.slice(0, 10)}…{asset.contract_address?.slice(-6)}
        </div>
        {asset.mint_tx_hash && (
          <a
            href={`https://polygonscan.com/tx/${asset.mint_tx_hash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
          >
            View transaction <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>
    );
  }

  if (!walletLinked) {
    return (
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-2">
          <Fingerprint className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-bold">On-Chain Username</h3>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Link a Polygon wallet first, then mint your handle as a permanent, non-transferable on-chain identity.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        <Fingerprint className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-bold">On-Chain Username</h3>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Mint your SwapPulse handle as a soulbound NFT on Polygon. It's permanent, non-transferable, and serves as your on-chain identity and crypto address.
      </p>
      <button
        onClick={handleMint}
        disabled={minting}
        className="mt-3 flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-primary/90 disabled:opacity-50"
      >
        {minting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Fingerprint className="h-4 w-4" />}
        Mint Username NFT
      </button>
    </div>
  );
}