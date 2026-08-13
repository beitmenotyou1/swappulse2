import React, { useMemo } from 'react';
import { Loader2, AlertCircle, ChevronDown } from 'lucide-react';
import { useAvailableSets } from '@/hooks/useSetChecklist';

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
      <label htmlFor="set-selector" className="block text-sm font-medium text-muted-foreground">
        Choose a set
      </label>
      <div className="relative">
        <select
          id="set-selector"
          value={selectedSetId ?? ''}
          onChange={(e) => onSelect(e.target.value)}
          className="w-full appearance-none rounded-lg border border-border bg-card px-4 py-3 pr-10 text-sm font-semibold text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        >
          <option value="">Select a set…</option>
          {sortedSets.map((set) => (
            <option key={set.setId} value={set.setId}>
              {set.setName} ({set.cardCount} cards)
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      </div>
    </div>
  );
}