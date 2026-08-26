import React, { useState, useEffect } from 'react';
import { Usb, Loader2, Check, Unlink, ShieldCheck, AlertCircle } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { connectAndSignLedger, isLedgerSupported } from '@/lib/hardwareWallet';

// Hardware wallet connection card — supports Ledger now, with Tangem and
// other hardware wallets coming soon. Lets the collector connect their
// hardware wallet via WebUSB, sign an EIP-4361 message to prove ownership,
// and link it to their SwapPulse account.
export default function HardwareWalletCard({ onLinked }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [link, setLink] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const userDid = user?.data?.did || user?.did;

  const load = async () => {
    if (!userDid) { setLoading(false); return; }
    try {
      const links = await base44.entities.WalletLink.filter({ did: userDid, active: true });
      // Only show hardware wallet links here (extension links are in WalletLinkCard)
      const hwLink = links.find((l) => l.hardware);
      setLink(hwLink || null);
    } catch { setLink(null); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [userDid]);

  const handleConnectLedger = async () => {
    if (!userDid) {
      toast({ title: 'No DID found', description: 'Your AT Protocol identity is not set up yet.', variant: 'destructive' });
      return;
    }
    if (!isLedgerSupported()) {
      toast({ title: 'Not supported', description: 'WebUSB is required. Use Chrome, Edge, or another WebUSB-compatible browser.', variant: 'destructive' });
      return;
    }
    setBusy(true);
    try {
      const { address, signature, message, nonce } = await connectAndSignLedger(userDid);
      const res = await base44.functions.invoke('link-wallet', {
        address,
        signature,
        message,
        nonce,
        did: userDid,
        hardware: true,
        wallet_type: 'ledger',
      });
      setLink(res.data.link);
      toast({ title: 'Ledger connected', description: address });
      if (onLinked) onLinked();
    } catch (e) {
      toast({ title: 'Could not connect Ledger', description: e.message || 'Connection failed', variant: 'destructive' });
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
      toast({ title: 'Ledger unlinked' });
      if (onLinked) onLinked();
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
        <Usb className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-bold">Hardware Wallet</h3>
        <span className="ml-auto rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-bold text-accent">Ledger</span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Connect a Ledger hardware wallet via USB. Your private key never leaves the device —
        all signing happens on the Ledger itself. Tangem and other hardware wallets coming soon.
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
            <Unlink className="h-3.5 w-3.5" /> Unlink Ledger
          </button>
        </div>
      ) : (
        <button
          onClick={handleConnectLedger}
          disabled={busy || !isLedgerSupported()}
          className="mt-3 flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-primary/90 disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Usb className="h-4 w-4" />}
          {busy ? 'Connecting...' : 'Connect Ledger'}
        </button>
      )}

      {!isLedgerSupported() && !link && (
        <div className="mt-2 flex items-start gap-1.5 rounded-lg bg-warning/5 px-2 py-1.5">
          <AlertCircle className="mt-0.5 h-3 w-3 shrink-0 text-warning" />
          <p className="text-[11px] leading-snug text-warning">WebUSB requires Chrome, Edge, or another compatible browser.</p>
        </div>
      )}
    </div>
  );
}