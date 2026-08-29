import React, { useState } from 'react';
import { Tag, Loader2, X } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { useMyLabelers } from '@/lib/myLabelers';
import { invalidateCommunityLabels } from '@/lib/communityLabels';
import SettingSelect from '@/components/settings/SettingSelect';

// LabelContentButton — shown on posts, profiles, and trade listings. Lets a
// collector who owns an approved CommunityLabeler apply a label to the content.
// Opens a compact dialog to pick which labeler + label value, then calls the
// apply-community-label backend function. Hidden entirely if the user owns no
// approved labelers (checked via the session-cached useMyLabelers hook).
export default function LabelContentButton({ subjectUri, subjectType, className = '' }) {
  const { toast } = useToast();
  const labelers = useMyLabelers();
  const [open, setOpen] = useState(false);
  const [selectedLabeler, setSelectedLabeler] = useState(null);
  const [selectedValue, setSelectedValue] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  if (!labelers.length) return null;

  const openDialog = () => {
    if (!selectedLabeler && labelers.length) setSelectedLabeler(labelers[0]);
    setOpen(true);
  };

  const apply = async () => {
    if (!selectedLabeler || !selectedValue || !subjectUri) return;
    setBusy(true);
    try {
      const res = await base44.functions.invoke('apply-community-label', {
        action: 'apply',
        labeler_id: selectedLabeler.id,
        subject_uri: subjectUri,
        subject_type: subjectType,
        label_value: selectedValue,
        note,
      });
      if (res?.error) throw new Error(res.error);
      toast({ title: 'Label applied' });
      setOpen(false);
      setSelectedValue('');
      setNote('');
      invalidateCommunityLabels(subjectUri);
    } catch (e) {
      toast({ title: e?.message || 'Could not apply label', variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const labelValues = selectedLabeler?.label_values || [];

  return (
    <>
      <button
        onClick={openDialog}
        aria-label="Apply community label"
        className={`rounded-full px-2 py-1 transition-colors hover:bg-primary/10 hover:text-primary ${className}`}
      >
        <Tag className="h-4 w-4" />
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => !busy && setOpen(false)}>
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-elevated" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold">Apply community label</h3>
              <button onClick={() => !busy && setOpen(false)} className="relative rounded-full p-1 hover:bg-secondary before:content-[''] before:absolute before:-inset-2.5" aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-semibold text-muted-foreground">Labeler</label>
                <SettingSelect
                  value={selectedLabeler?.id || ''}
                  onChange={(val) => { setSelectedLabeler(labelers.find((l) => l.id === val)); setSelectedValue(''); }}
                  label="Labeler"
                  options={labelers.map((l) => ({ value: l.id, label: `${l.name} (${l.category})` }))}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-muted-foreground">Label value</label>
                <div className="flex flex-wrap gap-2">
                  {labelValues.map((v) => (
                    <button
                      key={v}
                      onClick={() => setSelectedValue(v)}
                      className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${selectedValue === v ? 'border-primary bg-primary text-white' : 'border-border bg-secondary hover:bg-secondary/80'}`}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-muted-foreground" htmlFor="a11y-c94261c214">Note (optional)</label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  maxLength={280}
                  rows={2}
                  placeholder="Why are you applying this label?"
                  className="w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm"
                 id="a11y-c94261c214"/>
              </div>
              <button
                onClick={apply}
                disabled={busy || !selectedValue}
                className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white transition hover:bg-primary/90 disabled:opacity-50"
              >
                {busy ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : 'Apply label'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}