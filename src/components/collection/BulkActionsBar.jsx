import React, { useState } from 'react';
import { CheckSquare, Square, X, ArrowRightLeft, Loader2 } from 'lucide-react';
import SettingSelect from '@/components/settings/SettingSelect';

const CONDITIONS = [
  { value: 'mint', label: 'Mint' },
  { value: 'near_mint', label: 'Near Mint' },
  { value: 'excellent', label: 'Excellent' },
  { value: 'good', label: 'Good' },
  { value: 'damaged', label: 'Damaged' },
];

export default function BulkActionsBar({ selectedCount, allSelected, onSelectAll, onClear, onMoveToTrade, onUpdateCondition, busy }) {
  const [condition, setCondition] = useState('near_mint');
  return (
    <div className="sticky top-0 z-20 mx-4 mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-primary bg-card p-3 shadow-elevated">
      <span className="text-sm font-bold">{selectedCount} selected</span>
      <button
        onClick={onSelectAll}
        className="flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-xs font-semibold text-secondary-foreground hover:bg-secondary/80"
      >
        {allSelected ? <CheckSquare className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5" />}
        {allSelected ? 'All selected' : 'Select all'}
      </button>
      <div className="flex items-center gap-1.5">
        <SettingSelect
          value={condition}
          onChange={setCondition}
          label="Condition to apply"
          options={CONDITIONS}
          className="!w-auto !rounded-full !border-border !bg-secondary !px-3 !py-1.5 !text-xs !font-semibold !text-secondary-foreground"
        />
        <button
          onClick={() => onUpdateCondition(condition)}
          disabled={busy}
          className="rounded-full bg-primary px-3 py-1.5 text-xs font-bold text-white hover:bg-primary/90 disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Set condition'}
        </button>
      </div>
      <button
        onClick={onMoveToTrade}
        disabled={busy}
        className="flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-bold text-white hover:bg-primary/90 disabled:opacity-50"
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowRightLeft className="h-3.5 w-3.5" />}
        Move to trade list
      </button>
      <button onClick={onClear} className="ml-auto text-muted-foreground hover:text-foreground" title="Clear selection" aria-label="Clear selection">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}