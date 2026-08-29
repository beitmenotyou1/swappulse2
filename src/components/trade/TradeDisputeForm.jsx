import React, { useState } from 'react';
import { Loader2, Flag, X, ImagePlus, AlertTriangle } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { ensureUserDid, stampRecord, NSID } from '@/lib/atproto';
import { bridgeTradeDispute } from '@/lib/federatedBridge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Image } from '@/components/ui/image';
import { assertImageUpload } from '@/lib/uploadGuard';

const REASONS = [
  { value: 'misgraded', label: 'Misgraded card', hint: 'Condition does not match what was agreed.' },
  { value: 'wrong_card', label: 'Wrong card sent', hint: 'Received a different card than offered.' },
  { value: 'damaged', label: 'Card damaged', hint: 'Card arrived damaged in transit.' },
  { value: 'not_received', label: 'Never received', hint: 'Cards never arrived after shipping.' },
  { value: 'scam', label: 'Suspected scam', hint: 'Deliberate deception or fraud.' },
  { value: 'other', label: 'Other', hint: 'Something else went wrong.' },
];

export default function TradeDisputeForm({ trade, me, open, onClose, onFiled }) {
  const { toast } = useToast();
  const [reason, setReason] = useState('');
  const [description, setDescription] = useState('');
  const [photoUrls, setPhotoUrls] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setReason('');
    setDescription('');
    setPhotoUrls([]);
  };

  const handlePhotos = async (files) => {
    const incoming = Array.from(files || []);
    if (incoming.length === 0) return;
    const remaining = Math.max(0, 8 - photoUrls.length);
    if (remaining === 0) {
      toast({ title: 'Up to 8 evidence photos', variant: 'destructive' });
      return;
    }
    if (incoming.length > remaining) {
      toast({ title: 'Some photos were skipped', description: `You can attach up to 8 photos. ${remaining} slot${remaining === 1 ? '' : 's'} remaining.` });
    }
    const list = incoming.slice(0, remaining);
    setUploading(true);
    try {
      const uploaded = [];
      for (const file of list) {
        assertImageUpload(file);
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        uploaded.push(file_url);
      }
      setPhotoUrls((prev) => [...prev, ...uploaded].slice(0, 8));
    } catch (e) {
      toast({ title: 'Upload failed', description: e.message, variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const removePhoto = (url) => setPhotoUrls((prev) => prev.filter((u) => u !== url));

  const submit = async () => {
    if (!reason) {
      toast({ title: 'Select a reason', variant: 'destructive' });
      return;
    }
    if (description.trim().length < 10) {
      toast({ title: 'Add more detail', description: 'Please describe the issue (at least 10 characters).', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      const { did, signingKey } = await ensureUserDid();
      const stamped = await stampRecord(
        {
          trade_id: trade.id,
          trade_ref: trade.at_uri || '',
          reason,
          description: description.trim(),
          photo_urls: photoUrls,
          filed_by_name: me?.full_name || 'Collector',
          filed_by_handle: me?.custom_handle || me?.username || me?.bsky_handle || 'collector',
          filed_by_avatar: '',
        },
        NSID.TRADE_DISPUTE,
        did,
        signingKey,
      );
      const created = await base44.entities.TradeDispute.create(stamped);
      bridgeTradeDispute(stamped).then((res) => {
        if (res.bridged) base44.entities.TradeDispute.update(created.id, res).catch(() => {});
      }).catch(() => {});
      toast({ title: 'Dispute filed', description: 'Our moderators will review your report.' });
      reset();
      onFiled?.();
      onClose?.();
    } catch (e) {
      toast({ title: 'Could not file dispute', description: e.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { reset(); onClose?.(); } }}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Flag className="h-5 w-5 text-destructive" /> Report a Trade Dispute
          </DialogTitle>
          <DialogDescription>
            Flag this trade for moderation if something went wrong with the cards you received. Include photos as evidence.
          </DialogDescription>
        </DialogHeader>

        <div className="mb-4 flex gap-2 rounded-xl border border-warning/40 bg-warning/10 p-3 text-xs text-foreground">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
          <p>
            <span className="font-bold">Please note:</span> SwapPulse is a community platform and cannot recover money or cards exchanged outside the app. We can only help with on-site matters, moderating the listing, warning or banning bad actors, and mediating through in-app messages.
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted-foreground">Reason</label>
            <div className="grid grid-cols-2 gap-2">
              {REASONS.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => setReason(r.value)}
                  className={`rounded-xl border px-3 py-2 text-left text-sm transition ${reason === r.value ? 'border-destructive bg-destructive/10 text-destructive' : 'border-border hover:bg-secondary'}`}
                >
                  <span className="block font-semibold">{r.label}</span>
                  <span className="mt-0.5 block text-[11px] text-muted-foreground">{r.hint}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted-foreground" htmlFor="a11y-8ccef66dab">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, 2000))}
              placeholder="Describe what happened, the condition, what was agreed, and what you received…"
              rows={4}
              className="w-full resize-none rounded-xl border border-border bg-secondary px-3 py-2 text-sm outline-none focus:border-primary"
             id="a11y-8ccef66dab"/>
            <p className="mt-0.5 text-right text-[10px] text-muted-foreground">{description.length}/2000</p>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted-foreground">Photos of cards received</label>
            <div className="flex flex-wrap gap-2">
              {photoUrls.map((url) => (
                <div key={url} className="relative">
                  <Image src={url} alt="Evidence" className="h-20 w-20 rounded-lg object-cover" fittingType="fill" />
                  <button
                    type="button"
                    onClick={() => removePhoto(url)}
                    className="absolute -right-1.5 -top-1.5 rounded-full bg-destructive p-0.5 text-white shadow"
                    aria-label="Remove photo"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              <label className="flex h-20 w-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-border text-muted-foreground transition hover:border-primary hover:text-primary">
                {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
                <span className="text-[10px] font-semibold">Add photo</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => handlePhotos(e.target.files)}
                  disabled={uploading}
                />
              </label>
            </div>
            <p className="mt-1.5 text-[11px] text-muted-foreground">Optional but recommended, photos help moderators verify your claim.</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => { reset(); onClose?.(); }} disabled={submitting}>Cancel</Button>
          <Button onClick={submit} disabled={submitting || uploading} className="bg-destructive text-white hover:bg-destructive/90">
            {submitting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Flag className="mr-1.5 h-4 w-4" />}
            File Dispute
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}