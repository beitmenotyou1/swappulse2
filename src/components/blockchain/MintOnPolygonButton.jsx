import React, { useState, useEffect } from 'react';
import { Loader2, ShieldCheck, ExternalLink } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { useCryptoEnabled } from '@/hooks/useCryptoEnabled';
import UnlockWalletModal from './UnlockWalletModal';

// Mint button shown on collection rows and card detail pages.
// Checks whether the user has a linked wallet and whether the card is
// already minted before allowing the mint action. If the user has a
// custodial wallet with a passkey or PIN, an unlock modal is shown first.
export default function MintOnPolygonButton({ collectionEntryId, cardName, onMinted }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { cryptoEnabled } = useCryptoEnabled();
  const [asset, setAsset] = useState(null);
  const [walletLinked, setWalletLinked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [minting, setMinting] = useState(false);
  const [unlockState, setUnlockState] = useState(null);

  useEffect(() => {
    if (!collectionEntryId) { setLoading(false); return; }
    (async () => {
      try {
        const links = user?.did
          ? await base44.entities.WalletLink.filter({ did: user.did, active: true })
          : [];
        setWalletLinked(links.length > 0);
        const existing = await base44.entities.OnChainAsset.filter({ linked_collection_entry_id: collectionEntryId });
        setAsset(existing[0] || null);
      } catch {
        setAsset(null);
        setWalletLinked(false);
      } finally {
        setLoading(false);
      }
    })();
  }, [collectionEntryId, user?.did]);

  const doMint = async (unlockCredential) => {
    setMinting(true);
    try {
      const res = await base44.functions.invoke('mint-card', { collectionEntryId, unlockCredential });
      if (res.data.requiresUnlock) {
        setUnlockState({ hasPasskey: res.data.hasPasskey, hasPin: res.data.hasPin });
        setMinting(false);
        return;
      }
      setAsset(res.data.asset);
      toast({ title: 'Card minted on Polygon!', description: cardName || 'NFT created' });
      if (onMinted) onMinted(res.data.asset);
    } catch (e) {
      const msg = e?.response?.data?.error || e.message;
      toast({ title: 'Mint failed', description: msg, variant: 'destructive' });
    } finally {
      setMinting(false);
    }
  };

  const handleMint = () => {
    if (!walletLinked) {
      toast({ title: 'No linked wallet', description: 'Create or link a wallet in Settings first.', variant: 'destructive' });
      return;
    }
    doMint(null);
  };

  const handleUnlock = (credential) => {
    setUnlockState(null);
    doMint(credential);
  };

  if (loading || !cryptoEnabled) return null;

  if (asset) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-bold text-primary">
        <ShieldCheck className="h-3 w-3" /> On-chain
        {asset.mint_tx_hash && (
          <a
            href={`https://polygonscan.com/tx/${asset.mint_tx_hash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-1 hover:underline"
          >
            <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </span>
    );
  }

  return (
    <>
      <button
        onClick={handleMint}
        disabled={minting}
        className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/5 px-3 py-1 text-xs font-semibold text-primary hover:bg-primary/10 disabled:opacity-50"
      >
        {minting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
        Mint on Polygon
      </button>
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