import React, { useState } from 'react';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { ChecklistIcon, BinderIcon } from '@/components/icons/CollectionIcons';
import { usePdfGeneration } from '@/hooks/usePdfGeneration';
import SettingSelect from '@/components/settings/SettingSelect';

export default function PdfDownloadPanel({ setId, setName, cards, totalCards, ownedLocalIds }) {
  const [checklistOpts, setChecklistOpts] = useState({ pageSize: 'a4' });
  const [binderOpts, setBinderOpts] = useState({ pageSize: 'a4' });

  const checklistGen = usePdfGeneration();
  const binderGen = usePdfGeneration();

  const ownedIds = cards.filter((c) => c.is_owned).map((c) => c.tcgdex_id);

  const handleChecklist = () => {
    checklistGen.mutate({
      setId, setName, totalCards, allCards: cards, ownedLocalIds: ownedIds,
      type: 'checklist', options: checklistOpts,
    });
  };

  const handleBinder = () => {
    binderGen.mutate({
      setId, setName, totalCards, allCards: cards, ownedLocalIds: ownedIds,
      type: 'binder', options: binderOpts,
    });
  };

  const PAGE_SIZE_OPTIONS = [
    { value: 'a4', label: 'A4 (Europe)' },
    { value: 'letter', label: 'US Letter' },
  ];

  const PageSizeSelect = ({ value, onChange }) => (
    <SettingSelect
      value={value}
      onChange={onChange}
      label="Paper size"
      options={PAGE_SIZE_OPTIONS}
    />
  );

  return (
    <div className="space-y-4">
      {/* Checklist PDF */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="mb-4 flex items-start gap-2">
          <ChecklistIcon className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div>
            <h3 className="font-bold">Comprehensive Checklist</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Full set overview with card thumbnails, rarity breakdown, and missing cards list.
            </p>
          </div>
        </div>
        <div className="mb-4">
          <label className="mb-1 block text-xs text-muted-foreground">Paper size</label>
          <PageSizeSelect value={checklistOpts.pageSize} onChange={(v) => setChecklistOpts((p) => ({ ...p, pageSize: v }))} />
        </div>
        <button
          onClick={handleChecklist}
          disabled={checklistGen.isPending}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {checklistGen.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ChecklistIcon className="h-4 w-4" />}
          {checklistGen.isPending ? 'Generating…' : 'Generate Checklist PDF'}
        </button>
        {checklistGen.isSuccess && (
          <div className="mt-3 flex items-center gap-2 rounded-lg border border-success/20 bg-success/5 p-3 text-sm text-success">
            <CheckCircle2 className="h-4 w-4" /> Checklist downloaded!
          </div>
        )}
        {checklistGen.isError && (
          <div className="mt-3 flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-xs text-destructive">
            <AlertCircle className="h-4 w-4" /> {checklistGen.error?.message || 'Generation failed.'}
          </div>
        )}
      </div>

      {/* Binder Pages PDF */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="mb-4 flex items-start gap-2">
          <BinderIcon className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
          <div>
            <h3 className="font-bold">Binder Placeholder Pages</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Print-ready pages with card slots, QR codes, and notes fields for hybrid tracking.
            </p>
          </div>
        </div>
        <div className="mb-4">
          <label className="mb-1 block text-xs text-muted-foreground">Paper size</label>
          <PageSizeSelect value={binderOpts.pageSize} onChange={(v) => setBinderOpts((p) => ({ ...p, pageSize: v }))} />
        </div>
        <button
          onClick={handleBinder}
          disabled={binderGen.isPending}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-bold text-background transition-colors hover:bg-accent/90 disabled:opacity-50"
        >
          {binderGen.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <BinderIcon className="h-4 w-4" />}
          {binderGen.isPending ? 'Generating…' : 'Generate Binder Pages PDF'}
        </button>
        {binderGen.isSuccess && (
          <div className="mt-3 flex items-center gap-2 rounded-lg border border-success/20 bg-success/5 p-3 text-sm text-success">
            <CheckCircle2 className="h-4 w-4" /> Binder pages downloaded!
          </div>
        )}
        {binderGen.isError && (
          <div className="mt-3 flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-xs text-destructive">
            <AlertCircle className="h-4 w-4" /> {binderGen.error?.message || 'Generation failed.'}
          </div>
        )}
      </div>

      {/* Fair use notice */}
      <div className="rounded-lg bg-secondary/30 p-3">
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Card images sourced from TCGDex for catalogue purposes. Pokémon and all related characters are trademarks of Nintendo/Game Freak.
          SwapPulse is a community tool and is not affiliated with or endorsed by Nintendo. Generated PDFs are for personal collecting use only.
        </p>
      </div>
    </div>
  );
}