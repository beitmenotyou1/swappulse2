import React, { useState, useEffect } from 'react';
import { X, Loader2, Plus, Trash2, Shield } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';

// Receive allowlist management: add/remove trusted addresses and toggle
// strict mode (block incoming transfers from non-allowlisted senders).
export default function ReceiveAllowlistSection({ allowlistedAddresses, strictMode, onUpdated }) {
  const { toast } = useToast();
  const [adding, setAdding] = useState(false);
  const [newAddress, setNewAddress] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [loading, setLoading] = useState(false);
  const [strict, setStrict] = useState(strictMode || false);

  const handleAdd = async () => {
    if (!newAddress.trim()) return;
    setLoading(true);
    try {
      const res = await base44.functions.invoke('add-receive-allowlist', {
        address: newAddress.trim(),
        label: newLabel.trim(),
      });
      if (res.data?.error) {
        toast({ title: 'Failed', description: res.data.error, variant: 'destructive' });
        return;
      }
      toast({ title: 'Address added to allowlist' });
      setNewAddress('');
      setNewLabel('');
      setAdding(false);
      onUpdated();
    } catch (e) {
      toast({ title: 'Failed', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async (address) => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke('remove-receive-allowlist', { address });
      if (res.data?.error) {
        toast({ title: 'Failed', description: res.data.error, variant: 'destructive' });
        return;
      }
      toast({ title: 'Address removed' });
      onUpdated();
    } catch (e) {
      toast({ title: 'Failed', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStrict = async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke('toggle-receive-strict', { enabled: !strict });
      if (res.data?.error) {
        toast({ title: 'Failed', description: res.data.error, variant: 'destructive' });
        return;
      }
      setStrict(!strict);
      toast({ title: strict ? 'Strict mode disabled' : 'Strict mode enabled' });
      onUpdated();
    } catch (e) {
      toast({ title: 'Failed', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center gap-2">
        <Shield className="h-5 w-5 text-primary" />
        <h3 className="text-sm font-bold">Receive Allowlist</h3>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">
        Only accept crypto from addresses you've traded with or explicitly allowlisted.
      </p>

      {/* Strict mode toggle */}
      <div className="mb-3 flex items-center justify-between rounded-lg bg-secondary p-3">
        <div>
          <p className="text-sm font-semibold">Strict Mode</p>
          <p className="text-xs text-muted-foreground">Block all non-allowlisted incoming transfers</p>
        </div>
        <button
          onClick={handleToggleStrict}
          disabled={loading}
          className={`relative h-6 w-11 rounded-full transition ${strict ? 'bg-primary' : 'bg-border-strong'}`}
        >
          <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${strict ? 'left-[22px]' : 'left-0.5'}`} />
        </button>
      </div>

      {/* Allowlisted addresses */}
      {allowlistedAddresses && allowlistedAddresses.length > 0 ? (
        <div className="space-y-2">
          {allowlistedAddresses.map((addr, i) => (
            <div key={i} className="flex items-center justify-between rounded-lg border border-border p-2">
              <p className="truncate font-mono text-xs">{addr}</p>
              <button
                onClick={() => handleRemove(addr)}
                disabled={loading}
                className="shrink-0 rounded-full p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="mb-3 text-xs text-muted-foreground">No addresses added yet.</p>
      )}

      {adding ? (
        <div className="mt-3 space-y-2">
          <input
            type="text"
            value={newAddress}
            onChange={(e) => setNewAddress(e.target.value)}
            placeholder="0x… address"
            className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm font-mono outline-none focus:border-primary"
          />
          <input
            type="text"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="Label (optional)"
            className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <div className="flex gap-2">
            <button
              onClick={() => { setAdding(false); setNewAddress(''); setNewLabel(''); }}
              className="flex-1 rounded-full border border-border bg-secondary px-3 py-2 text-xs font-bold hover:bg-secondary/80"
            >
              Cancel
            </button>
            <button
              onClick={handleAdd}
              disabled={loading || !newAddress.trim()}
              className="flex flex-1 items-center justify-center gap-1 rounded-full bg-primary px-3 py-2 text-xs font-bold text-white hover:bg-primary/90 disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
              Add
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-full border border-dashed border-border px-3 py-2 text-xs font-bold text-muted-foreground hover:bg-secondary"
        >
          <Plus className="h-3.5 w-3.5" />
          Add Address
        </button>
      )}
    </div>
  );
}