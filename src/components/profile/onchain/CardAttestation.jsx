import React, { useEffect, useState } from 'react';
import { Camera, Loader2, ShieldCheck, Upload, XCircle } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/lib/AuthContext';
import { Image } from '@/components/ui/image';

export default function CardAttestation({ attestations, onReload, identity }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [collection, setCollection] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    base44.entities.CollectionEntry.filter({ created_by_id: user.id }, '-updated_date', 100)
      .then((entries) => {
        // Only exclude cards that have been AI-verified (level >= 2). Level-0
        // self-attested cards (from auto-attest) should remain selectable so
        // collectors can upgrade them to photo-verified attestations.
        const aiVerifiedIds = new Set((attestations || [])
          .filter((a) => a.status === 'verified' && Number(a.verification_level) >= 2)
          .map((a) => a.collection_entry_id));
        setCollection(entries.filter((e) => !aiVerifiedIds.has(e.id)));
      })
      .catch(() => setCollection([]))
      .finally(() => setLoading(false));
  }, [user?.id, attestations]);

  const onFileSelect = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    if (photos.length + files.length > 4) { toast({ title: 'Maximum 4 photos', variant: 'destructive' }); return; }
    setUploading(true);
    try {
      const uploaded = [];
      for (const file of files) {
        const res = await base44.integrations.Core.UploadFile({ file });
        uploaded.push(res.file_url);
      }
      setPhotos((prev) => [...prev, ...uploaded]);
    } catch (error) {
      toast({ title: 'Upload failed', description: error?.message, variant: 'destructive' });
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const removePhoto = (url) => setPhotos((prev) => prev.filter((p) => p !== url));

  const submit = async () => {
    if (!selected || photos.length === 0) return;
    setSubmitting(true);
    try {
      const res = await base44.functions.invoke('create-card-attestation', {
        collection_entry_id: selected.id,
        card_id: selected.card_id,
        card_name: selected.card_name,
        scan_image_urls: photos,
      });
      const data = res?.data || res;
      if (data?.attested) {
        toast({ title: 'Card attested', description: `Verification level ${data.verification_level} — your card possession is proven.` });
      } else {
        toast({ title: 'Verification failed', description: 'The AI could not verify your card photos. Try clearer photos.', variant: 'destructive' });
      }
      setSelected(null);
      setPhotos([]);
      await onReload();
    } catch (error) {
      toast({ title: 'Attestation failed', description: error?.response?.data?.error || error?.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const LEVEL_META = {
    0: { label: 'SELF', badge: 'bg-secondary text-muted-foreground', border: 'border-border bg-secondary/30', icon: 'text-muted-foreground' },
    1: { label: 'SCANNED', badge: 'bg-warning/10 text-warning', border: 'border-warning/20 bg-warning/5', icon: 'text-warning' },
    2: { label: 'AI VERIFIED', badge: 'bg-success/10 text-success', border: 'border-success/20 bg-success/5', icon: 'text-success' },
    3: { label: 'GRADED', badge: 'bg-primary/10 text-primary', border: 'border-primary/20 bg-primary/5', icon: 'text-primary' },
  };
  const levelMeta = (lvl) => LEVEL_META[Number(lvl)] || LEVEL_META[0];

  const verifiedAttestations = (attestations || [])
    .filter((a) => a.status === 'verified')
    .sort((a, b) => Number(b.verification_level || 0) - Number(a.verification_level || 0));

  return (
    <div className="space-y-4">
      {verifiedAttestations.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground">Attested cards ({verifiedAttestations.length})</p>
          {verifiedAttestations.map((att) => {
            const meta = levelMeta(att.verification_level);
            return (
              <div key={att.id} className={`flex items-center gap-3 rounded-lg border p-3 ${meta.border}`}>
                <ShieldCheck className={`h-5 w-5 shrink-0 ${meta.icon}`} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{att.card_name}</p>
                  <p className="text-xs text-muted-foreground">Level {att.verification_level} · {new Date(att.created_date).toLocaleDateString()}</p>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${meta.badge}`}>{meta.label}</span>
              </div>
            );
          })}
        </div>
      )}

      {!identity && (
        <div className="rounded-lg border border-border bg-secondary/30 p-3 text-xs text-muted-foreground">
          <p className="font-bold">On-chain identity required</p>
          <p className="mt-1">Create your SwapPulse identity above before attesting card ownership.</p>
        </div>
      )}

      {identity && !selected && (
        <div>
          <p className="mb-2 text-xs font-semibold text-muted-foreground">Select a card to attest</p>
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
          ) : collection.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No unattested cards in your collection. Add cards first.</p>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {collection.slice(0, 12).map((entry) => (
                <button key={entry.id} onClick={() => setSelected(entry)} className="rounded-lg border border-border bg-card p-2 text-left transition-colors hover:border-primary">
                  {entry.card_image ? (
                    <Image src={entry.card_image} alt={entry.card_name} className="mb-1.5 aspect-[3/4] w-full rounded object-cover" />
                  ) : (
                    <div className="mb-1.5 flex aspect-[3/4] w-full items-center justify-center rounded bg-secondary">
                      <Camera className="h-6 w-6 text-muted-foreground" />
                    </div>
                  )}
                  <p className="truncate text-xs font-medium">{entry.card_name}</p>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {identity && selected && (
        <div className="space-y-3 rounded-xl border border-border bg-card p-4">
          <div className="flex items-start gap-3">
            {selected.card_image && <Image src={selected.card_image} alt={selected.card_name} className="h-20 w-16 rounded object-cover" />}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold">{selected.card_name}</p>
              <p className="text-xs text-muted-foreground">Upload photos of your physical card</p>
            </div>
            <button onClick={() => { setSelected(null); setPhotos([]); }} className="shrink-0 text-xs text-muted-foreground hover:text-foreground">Cancel</button>
          </div>

          {photos.length > 0 && (
            <div className="grid grid-cols-4 gap-2">
              {photos.map((url) => (
                <div key={url} className="relative">
                  <Image src={url} alt="Scan" className="aspect-square w-full rounded-lg object-cover" />
                  <button onClick={() => removePhoto(url)} className="absolute -right-1 -top-1 rounded-full bg-destructive p-1 text-destructive-foreground">
                    <XCircle className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {photos.length < 4 && (
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-border p-4 text-xs text-muted-foreground hover:border-primary hover:text-primary">
              <Upload className="h-4 w-4" />
              {uploading ? 'Uploading…' : 'Upload card photos'}
              <input type="file" accept="image/*" multiple className="hidden" onChange={onFileSelect} disabled={uploading} />
            </label>
          )}

          <button onClick={submit} disabled={submitting || photos.length === 0} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-50">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
            {submitting ? 'Verifying…' : 'Attest Card Ownership'}
          </button>
          <p className="text-center text-[10px] text-muted-foreground">
            AI vision compares your photos with the reference card. Your on-chain identity signs the attestation.
          </p>
        </div>
      )}
    </div>
  );
}