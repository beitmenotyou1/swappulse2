import React, { useState, useEffect, useCallback } from 'react';
import { Shield, Plus, Trash2, Loader2, Check, AlertCircle } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { CHAINS, getChain } from '@/lib/chainRegistry';
import { validateAddress } from '@/lib/addressValidation';

// Allowlist manager: lets collectors control which sender addresses can
// send them crypto/NFTs. Only assets from allowlisted senders appear in
// the wallet. Traded contacts (from completed EscrowTrades) are implicitly
// allowlisted. Uses the ReceiveAllowlist entity via the SDK.
export default function AllowlistManager() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newAddress, setNewAddress] = useState('');
  const [newChain, setNewChain] = useState('');
  const [newLabel, setNewLabel] = useState('');

  const userDid = user?.data?.did || user?.did;

  const loadAllowlist = useCallback(async () => {
    if (!userDid) { setLoading(false); return; }
    try {
      const list = await base44.entities.ReceiveAllowlist.filter(
        { did: userDid }, '-added_at', 500
      );
      setEntries(list || []);
    } catch (e) {
      console.error('Allowlist load error:', e);
    } finally {
      setLoading(false);
    }
  }, [userDid]);

  useEffect(() => { loadAllowlist(); }, [loadAllowlist]);

  const validation = validateAddress(newAddress, newChain);
  const showValidation = newAddress.trim().length > 0 && !validation.valid;

  const handleAdd = async () => {
    if (!newAddress.trim()) return;
    const check = validateAddress(newAddress, newChain);
    if (!check.valid) {
      toast({ title: 'Invalid address', description: check.message, variant: 'destructive' });
      return;
    }
    setAdding(true);
    try {
      await base44.entities.ReceiveAllowlist.create({
        did: userDid,
        address: newAddress.trim().toLowerCase(),
        chain: newChain,
        label: newLabel.trim() || undefined,
        added_at: new Date().toISOString(),
      });
      toast({ title: 'Address added to allowlist' });
      setNewAddress('');
      setNewLabel('');
      setNewChain('');
      loadAllowlist();
    } catch (e) {
      toast({ title: 'Failed to add address', description: e.message, variant: 'destructive' });
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (id) => {
    try {
      await base44.entities.ReceiveAllowlist.delete(id);
      toast({ title: 'Address removed from allowlist' });
      loadAllowlist();
    } catch (e) {
      toast({ title: 'Failed to remove', description: e.message, variant: 'destructive' });
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        <Shield className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-bold">Receive Allowlist</h3>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Only crypto and NFTs sent from addresses on this list will appear in your wallet.
        Contacts from completed trades are automatically allowlisted.
      </p>

      {/* Add form */}
      <div className="mt-3 space-y-2 rounded-lg bg-secondary p-3">
        <input
          type="text"
          value={newAddress}
          onChange={(e) => setNewAddress(e.target.value)}
          placeholder="Sender address (0x… or Solana base58)"
          className={`w-full rounded-lg border bg-card px-3 py-2 text-sm font-mono outline-none focus:border-primary ${
            showValidation ? 'border-destructive/50' : 'border-border'
          }`}
        />
        {showValidation && (
          <div className="flex items-start gap-1.5 rounded-lg bg-destructive/5 px-2 py-1.5">
            <AlertCircle className="mt-0.5 h-3 w-3 shrink-0 text-destructive" />
            <p className="text-[11px] leading-snug text-destructive">{validation.message}</p>
          </div>
        )}
        <div className="flex gap-2">
          <select
            value={newChain}
            onChange={(e) => setNewChain(e.target.value)}
            className="flex-1 rounded-lg border border-border bg-card px-2 py-2 text-xs outline-none focus:border-primary"
          >
            <option value="">All chains</option>
            {CHAINS.filter(c => c.rpcSecret).map(c => (
              <option key={c.key} value={c.key}>{c.name}</option>
            ))}
          </select>
          <input
            type="text"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="Label (optional)"
            className="flex-1 rounded-lg border border-border bg-card px-3 py-2 text-xs outline-none focus:border-primary"
          />
        </div>
        <button
          onClick={handleAdd}
          disabled={adding || !newAddress.trim() || showValidation}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-bold text-white hover:bg-primary/90 disabled:opacity-50"
        >
          {adding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
          Add to Allowlist
        </button>
      </div>

      {/* Allowlist entries */}
      {loading ? (
        <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
      ) : entries.length === 0 ? (
        <div className="mt-3 flex flex-col items-center justify-center py-6 text-center">
          <Check className="mb-2 h-6 w-6 text-muted-foreground" />
          <p className="text-xs text-muted-foreground">
            Your allowlist is empty. All incoming transfers are currently visible.
            Add trusted addresses to curate what appears in your wallet.
          </p>
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          {entries.map((entry) => {
            const chainDef = entry.chain ? getChain(entry.chain) : null;
            return (
              <div key={entry.id} className="flex items-center gap-2 rounded-lg border border-border p-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-mono text-xs font-semibold">{entry.address}</p>
                  <div className="flex items-center gap-1.5">
                    {chainDef && (
                      <span className="rounded-full bg-secondary px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                        {chainDef.symbol}
                      </span>
                    )}
                    {entry.label && (
                      <span className="text-[10px] text-muted-foreground">{entry.label}</span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => handleRemove(entry.id)}
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                  title="Remove from allowlist"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}