import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { base44 } from '@/api/base44Client';
import { AlertTriangle, ShieldAlert, Loader2, CheckCircle2 } from 'lucide-react';
import SettingSelect from '@/components/settings/SettingSelect';

const CONFIRM_WORD = 'DELETE';

export default function ForceDeleteDialog({ user, open, onClose, onDone }) {
  const [step, setStep] = useState(1);
  const [confirmText, setConfirmText] = useState('');
  const [reason, setReason] = useState('scam');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const reset = () => { setStep(1); setConfirmText(''); setError(''); };

  const handleFinalConfirm = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await base44.functions.invoke('enforcement', { op: 'force_delete', user_id: user.id, reason });
      if (res.data?.ok) { onDone(); onClose(); reset(); }
      else { setError(res.data?.error || 'Deletion failed'); setStep(3); }
    } catch (e) { setError(e.message || 'Deletion failed'); setStep(3); }
    setLoading(false);
  };

  if (!open) return null;
  const targetLabel = user?.username || user?.email || 'this user';

  return (
    <>
      <Dialog open={step === 1} onOpenChange={(o) => { if (!o) { onClose(); reset(); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="mx-auto mb-2 rounded-full bg-destructive/10 p-3"><AlertTriangle className="h-6 w-6 text-destructive" /></div>
            <DialogTitle className="text-center">Permanently delete {targetLabel}?</DialogTitle>
            <DialogDescription className="text-center text-sm">
              This will permanently delete the account, erase all data, and block re-registration. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div>
            <Label className="mb-1.5 block text-sm font-medium">Blocklist reason</Label>
            <SettingSelect
              value={reason}
              onChange={setReason}
              label="Blocklist reason"
              options={[
                { value: 'scam', label: 'Scam' },
                { value: 'spam', label: 'Spam' },
                { value: 'harassment', label: 'Harassment' },
                { value: 'ban_evasion', label: 'Ban evasion' },
                { value: 'other', label: 'Other' },
              ]}
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => { onClose(); reset(); }}>Cancel</Button>
            <Button variant="destructive" onClick={() => setStep(2)}>Continue</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={step === 2} onOpenChange={(o) => { if (!o) { onClose(); reset(); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="mx-auto mb-2 rounded-full bg-destructive/10 p-3"><AlertTriangle className="h-6 w-6 text-destructive" /></div>
            <DialogTitle className="text-center">All data will be erased</DialogTitle>
            <DialogDescription className="text-center text-sm">
              The user's collection, trades, posts, binders, and reputation will be permanently erased. Reports and disputes will be anonymised for audit. Continue?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => { onClose(); reset(); }}>Cancel</Button>
            <Button variant="destructive" onClick={() => setStep(3)}>Continue</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={step === 3} onOpenChange={(o) => { if (!o) { onClose(); reset(); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="mx-auto mb-2 rounded-full bg-destructive/10 p-3"><ShieldAlert className="h-6 w-6 text-destructive" /></div>
            <DialogTitle className="text-center">Final confirmation</DialogTitle>
            <DialogDescription className="text-center text-sm">
              Type <span className="font-mono font-bold text-destructive">{CONFIRM_WORD}</span> to permanently delete {targetLabel}'s account and block re-registration.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder={CONFIRM_WORD} className="font-mono" autoFocus />
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => { onClose(); reset(); }}>Cancel</Button>
            <Button variant="destructive" disabled={confirmText !== CONFIRM_WORD || loading} onClick={handleFinalConfirm}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Delete permanently'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}