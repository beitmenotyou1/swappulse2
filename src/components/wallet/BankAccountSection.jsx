import React, { useState } from 'react';
import { Building2, Lock, Plus, Check, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';

export default function BankAccountSection({ bankAccount, onUpdated }) {
  const { toast } = useToast();
  const [editing, setEditing] = useState(!bankAccount);
  const [iban, setIban] = useState('');
  const [bic, setBic] = useState('');
  const [holderName, setHolderName] = useState('');
  const [bankName, setBankName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!iban || !bic) {
      toast({ title: 'Missing details', description: 'IBAN and BIC are required', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      const res = await base44.functions.invoke('setup-bank-account', {
        iban, bic, account_holder_name: holderName, bank_name: bankName,
      });
      if (res.data?.error) {
        toast({ title: 'Failed', description: res.data.error, variant: 'destructive' });
        return;
      }
      toast({ title: 'Bank account saved', description: 'Your bank details are encrypted and stored securely.' });
      setEditing(false);
      setIban(''); setBic(''); setHolderName(''); setBankName('');
      onUpdated();
    } catch (e) {
      toast({ title: 'Failed', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  if (!editing && bankAccount) {
    return (
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-primary" />
          <h3 className="text-sm font-bold">Linked Bank Account</h3>
          <span className="ml-auto flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-bold text-success">
            <Check className="h-3 w-3" /> ACTIVE
          </span>
        </div>
        <div className="mt-3 space-y-2">
          <div className="flex items-center gap-2">
            <Lock className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">IBAN</span>
            <span className="ml-auto font-mono text-sm font-semibold">{bankAccount.iban_masked}</span>
          </div>
          <div className="flex items-center gap-2">
            <Lock className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">BIC/Swift</span>
            <span className="ml-auto font-mono text-sm font-semibold">{bankAccount.bic_masked}</span>
          </div>
          {bankAccount.account_holder_name && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Holder</span>
              <span className="ml-auto text-sm font-semibold">{bankAccount.account_holder_name}</span>
            </div>
          )}
          {bankAccount.bank_name && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Bank</span>
              <span className="ml-auto text-sm font-semibold">{bankAccount.bank_name}</span>
            </div>
          )}
        </div>
        <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Lock className="h-3 w-3" /> Your bank details are end-to-end encrypted.
        </p>
        <button
          onClick={() => setEditing(true)}
          className="mt-3 flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-semibold hover:bg-secondary"
        >
          <Plus className="h-4 w-4" /> Update Bank Account
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        <Building2 className="h-5 w-5 text-primary" />
        <h3 className="text-sm font-bold">{bankAccount ? 'Update Bank Account' : 'Link Your Bank Account'}</h3>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        When crypto features are off, top-ups and trade payments are routed to your bank account.
        Your IBAN and BIC are stored end-to-end encrypted.
      </p>
      <div className="mt-4 space-y-3">
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">Account Holder Name</label>
          <input
            type="text"
            value={holderName}
            onChange={(e) => setHolderName(e.target.value)}
            placeholder="John Smith"
            className="w-full rounded-xl border border-border bg-secondary px-3 py-2.5 text-sm outline-none focus:border-primary"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">IBAN</label>
          <input
            type="text"
            value={iban}
            onChange={(e) => setIban(e.target.value)}
            placeholder="GB29 NWBK 6016 1331 9268 19"
            className="w-full rounded-xl border border-border bg-secondary px-3 py-2.5 text-sm font-mono outline-none focus:border-primary"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">BIC / Swift Code</label>
          <input
            type="text"
            value={bic}
            onChange={(e) => setBic(e.target.value)}
            placeholder="NWBKGB2L"
            className="w-full rounded-xl border border-border bg-secondary px-3 py-2.5 text-sm font-mono outline-none focus:border-primary"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">Bank Name (optional)</label>
          <input
            type="text"
            value={bankName}
            onChange={(e) => setBankName(e.target.value)}
            placeholder="NatWest"
            className="w-full rounded-xl border border-border bg-secondary px-3 py-2.5 text-sm outline-none focus:border-primary"
          />
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        {bankAccount && (
          <button
            onClick={() => setEditing(false)}
            className="flex-1 rounded-full border border-border px-4 py-2.5 text-sm font-semibold hover:bg-secondary"
          >
            Cancel
          </button>
        )}
        <button
          onClick={handleSave}
          disabled={loading}
          className="flex flex-1 items-center justify-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-bold text-white hover:bg-primary/90 disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
          Save (Encrypted)
        </button>
      </div>
    </div>
  );
}