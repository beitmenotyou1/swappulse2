import React, { useMemo } from 'react';
import { Loader2, AlertCircle } from 'lucide-react';
import { useAvailableSets } from '@/hooks/useSetChecklist';
import SettingSelect from '@/components/settings/SettingSelect';

export default function SetSelector({ selectedSetId, onSelect }) {
  const { data: sets, isLoading, error } = useAvailableSets();

  const sortedSets = useMemo(() => sets || [], [sets]);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-3">
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
        <span className="text-sm text-muted-foreground">Loading sets…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
        <AlertCircle className="h-4 w-4 text-destructive" />
        <p className="text-sm text-destructive">Couldn't load the set list.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-muted-foreground">
        Choose a set
      </label>
      <SettingSelect
        value={selectedSetId ?? ''}
        onChange={onSelect}
        label="Choose a set"
        options={[
          { value: '', label: 'Select a set…' },
          ...sortedSets.map((set) => ({
            value: set.setId,
            label: `${set.setName} (${set.cardCount} cards)`,
          })),
        ]}
      />
    </div>
  );
}