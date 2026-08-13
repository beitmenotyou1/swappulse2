import React, { useEffect, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';

export default function CompletionProgress({ percentage, ownedCount, totalCount, setName }) {
  const [animated, setAnimated] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => setAnimated(percentage), 100);
    return () => clearTimeout(timer);
  }, [percentage]);

  const isComplete = percentage === 100;

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold">{setName}</h3>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {ownedCount} of {totalCount} cards collected
          </p>
        </div>
        {isComplete && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-3 py-1 text-xs font-semibold text-success">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Set Complete!
          </span>
        )}
      </div>

      {/* Progress bar */}
      <div className="relative h-6 w-full overflow-hidden rounded-full bg-secondary">
        <div
          className={`absolute inset-y-0 left-0 rounded-full transition-all duration-1000 ease-out ${
            isComplete
              ? 'bg-gradient-to-r from-success to-emerald-400'
              : 'bg-gradient-to-r from-primary to-primary-muted'
          }`}
          style={{ width: `${animated}%` }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse" />
        </div>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xs font-bold text-white mix-blend-difference">{animated}%</span>
        </div>
      </div>

      {/* Quick stats */}
      <div className="mt-4 flex items-center gap-6 text-sm">
        <div className="flex items-center gap-2">
          <div className="h-2.5 w-2.5 rounded-full bg-success" />
          <span className="text-muted-foreground">Owned: {ownedCount}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-2.5 w-2.5 rounded-full bg-destructive" />
          <span className="text-muted-foreground">Missing: {totalCount - ownedCount}</span>
        </div>
      </div>
    </div>
  );
}