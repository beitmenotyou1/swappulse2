import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { base44 } from '@/api/base44Client';
import { Loader2, Ban } from 'lucide-react';
import SettingSelect from '@/components/settings/SettingSelect';

export default function SuspendDialog({ user, open, onClose, onDone }) {
  const [reason, setReason] = useState('');
  const [duration, setDuration] = useState('7');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSuspend = async () => {
    setLoading(true);
    setError('');
    try {
      const suspended_until = duration === 'indefinite' ? null : new Date(Date.now() + parseInt(duration) * 86400000).toISOString();
      const res = await base44.functions.invoke('enforcement', { op: 'suspend', user_id: user.id, reason, suspended_until });
      if (res.data?.ok) { onDone(); onClose(); setReason(''); }
      else setError(res.data?.error || 'Failed to suspend');
    } catch (e) { setError(e.message || 'Failed to suspend'); }
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-2 rounded-full bg-warning/10 p-3"><Ban className="h-6 w-6 text-warning" /></div>
          <DialogTitle className="text-center">Suspend account</DialogTitle>
          <DialogDescription className="text-center text-sm">
            Suspend <strong>{user?.username || user?.email}</strong>? They won't be able to log in or post, and their content will be hidden.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="reason">Reason (shown to user at login)</Label>
            <Input id="reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Repeated scam attempts" />
          </div>
          <div>
            <Label htmlFor="duration">Duration</Label>
            <SettingSelect
              value={duration}
              onChange={setDuration}
              label="Duration"
              options={[
                { value: '1', label: '1 day' },
                { value: '3', label: '3 days' },
                { value: '7', label: '7 days' },
                { value: '30', label: '30 days' },
                { value: '90', label: '90 days' },
                { value: 'indefinite', label: 'Indefinite (until manually lifted)' },
              ]}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="destructive" onClick={handleSuspend} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Suspend'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}