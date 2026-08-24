import React, { useState, useEffect } from 'react';
import { Loader2, Fingerprint, Check, ExternalLink } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { useCryptoEnabled } from '@/hooks/useCryptoEnabled';
import UnlockWalletModal from './UnlockWalletModal';
import UsernameNftPreview from './UsernameNftPreview';

export default function UsernameMintCard({ walletLinked }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { cryptoEnabled } = useCryptoEnabled();
  const [asset, setAsset] = useState(null);
  const [loading, setLoading] = useState(true);
  const [minting, setMinting] = useState(false);
  const [unlockState, setUnlockState] = useState(null);

  const userDid = user?.data?.did || user?.did;
  const handle = user?.bsky_handle || user?.username || '';
  const displayName = user?.data?.display_name || user?.full_name || handle;
  const memberSince = user?.created_date;

  const load = async () => {
    if (!userDid) { setLoading(false); return; }
    try {
      const res = await base44.functions.invoke('get-on-chain-assets', { did: userDid, assetType: 'username' });
      setAsset(res.data.assets[0] || null);
    } catch { setAsset(null); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [userDid]);

  const doMint = async (unlockCredential) => {
    setMinting(true);
    try {
      const res = await base44.functions.invoke('mint-username', { unlockCredential });
      if (res.data.requiresUnlock) {
        setUnlockState({ hasPasskey: res.data.hasPasskey, hasPin: res.data.hasPin });
        setMinting(false);
        return;
      }
      if (res.data.alreadyMinted) {
        setAsset(res.data.asset);
        toast({ title: 'Already minted', description: 'Your username NFT is already on-chain.' });
        return;
      }
      setAsset(res.data.asset);
      toast({ title: 'Username minted on Polygon!', description: 'Your handle is now permanently on-chain.' });
    } catch (e) {
      const msg = e?.response?.data?.error || e.message;
      toast({ title: 'Mint failed', description: msg, variant: 'destructive' });
    } finally {
      setMinting(false);
    }
  };

  const handleUnlock = (credential) => {
    setUnlockState(null);
    doMint(credential);
  };

  if (loading || !cryptoEnabled) return null;

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
        <div className="mt-3 flex flex-col items-center gap-3">
          <UsernameNftPreview handle={asset.handle || handle} displayName={displayName} memberSince={memberSince} />
          <p className="text-center text-xs text-muted-foreground">
            Your handle <span className="font-semibold text-foreground">@{asset.handle}</span> is permanently minted as a soulbound NFT. The image and details update automatically when you edit your profile.
          </p>
        </div>
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
        <div className="mt-3 flex justify-center">
          <UsernameNftPreview handle={handle || 'yourhandle'} displayName={displayName} memberSince={memberSince} />
        </div>
        <p className="mt-3 text-center text-xs text-muted-foreground">
          Create or link a wallet first, then mint your handle as a permanent, non-transferable on-chain identity.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-2">
          <Fingerprint className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-bold">On-Chain Username</h3>
        </div>
        <div className="mt-3 flex flex-col items-center gap-3">
          <UsernameNftPreview handle={handle || 'yourhandle'} displayName={displayName} memberSince={memberSince} />
          <p className="text-center text-xs text-muted-foreground">
            Mint your SwapPulse handle as a soulbound NFT on Polygon. The logo, your username, and profile details are embedded in the NFT image and update automatically when you edit your profile.
          </p>
        </div>
        <button
          onClick={() => doMint(null)}
          disabled={minting}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-primary/90 disabled:opacity-50"
        >
          {minting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Fingerprint className="h-4 w-4" />}
          Mint Username NFT
        </button>
      </div>
      {unlockState && (
        <UnlockWalletModal
          open={true}
          unlockState={unlockState}
          onUnlock={handleUnlock}
          onCancel={() => { setUnlockState(null); setMinting(false); }}
        />
      )}
    </>
  );
}