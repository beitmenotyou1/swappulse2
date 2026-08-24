import React, { useState, useEffect } from 'react';
import { Wallet, Loader2, Check, Unlink, ShieldCheck } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { connectWallet, signWalletLinkMessage, hasWallet } from '@/lib/polygonWallet';
import { useToast } from '@/components/ui/use-toast';

export default function WalletLinkCard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [link, setLink] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    if (!user?.did) { setLoading(false); return; }
    try {
      const links = await base44.entities.WalletLink.filter({ did: user.did, active: true });
      setLink(links[0] || null);
    } catch { setLink(null); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [user?.did]);

  const handleLink = async () => {
    if (!hasWallet()) {
      toast({ title: 'No wallet found', description: 'Install MetaMask or a Polygon-compatible wallet extension.', variant: 'destructive' });
      return;
    }
    if (!user?.did) {
      toast({ title: 'No DID found', description: 'Your AT Protocol identity is not set up yet.', variant: 'destructive' });
      return;
    }
    setBusy(true);
    try {
      const address = await connectWallet();
      const { signature, message, nonce } = await signWalletLinkMessage(address, user.did);
      const res = await base44.functions.invoke('link-wallet', { address, signature, message, nonce, did: user.did });
      setLink(res.data.link);
      toast({ title: 'Wallet linked', description: address });
    } catch (e) {
      toast({ title: 'Could not link wallet', description: e.message || 'Signing failed', variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const handleUnlink = async () => {
    if (!link) return;
    setBusy(true);
    try {
      await base44.entities.WalletLink.update(link.id, { active: false });
      setLink(null);
      toast({ title: 'Wallet unlinked' });
    } catch (e) {
      toast({ title: 'Could not unlink', description: e.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        <Wallet className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-bold">Polygon Wallet</h3>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Link a Polygon wallet to mint on-chain NFTs, verify your identity, and send/receive crypto.
      </p>

      {link ? (
        <div className="mt-3 space-y-2">
          <div className="flex items-center gap-2 rounded-lg bg-success/10 px-3 py-2">
            <ShieldCheck className="h-4 w-4 shrink-0 text-success" />
            <span className="truncate text-xs font-mono">{link.wallet_address}</span>
          </div>
          <button
            onClick={handleUnlink}
            disabled={busy}
            className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-secondary disabled:opacity-50"
          >
            <Unlink className="h-3.5 w-3.5" /> Unlink wallet
          </button>
        </div>
      ) : (
        <button
          onClick={handleLink}
          disabled={busy}
          className="mt-3 flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-primary/90 disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}
          Link Polygon Wallet
        </button>
      )}
    </div>
  );
}