import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { base44 } from '@/api/base44Client';
import { Loader2, EyeOff } from 'lucide-react';

export default function ShadowBanDialog({ user, open, onClose, onDone }) {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleShadowBan = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await base44.functions.invoke('enforcement', { op: 'shadow_ban', user_id: user.id, reason });
      if (res.data?.ok) { onDone(); onClose(); setReason(''); }
      else setError(res.data?.error || 'Failed to shadow ban');
    } catch (e) { setError(e.message || 'Failed to shadow ban'); }
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-2 rounded-full bg-secondary p-3"><EyeOff className="h-6 w-6 text-muted-foreground" /></div>
          <DialogTitle className="text-center">Shadow ban account</DialogTitle>
          <DialogDescription className="text-center text-sm">
            Shadow-ban <strong>{user?.username || user?.email}</strong>? Their content will be silently hidden from everyone else. They will not be notified.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="sb-reason">Internal reason (not shown to user)</Label>
            <Input id="sb-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Spam pattern detected" />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="secondary" onClick={handleShadowBan} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Shadow ban'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}