import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Info } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function OptInPrompt() {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;
  return (
    <div className="flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 p-4">
      <Info className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
      <div className="flex-1">
        <p className="text-sm font-semibold">Competitive challenges need leaderboard opt-in</p>
        <p className="mt-1 text-xs text-muted-foreground">Your rank will be visible to others. Choose which categories to appear on — revoke anytime.</p>
        <div className="mt-3 flex gap-2">
          <Link to="/settings"><Button size="sm">Manage preferences</Button></Link>
          <Button size="sm" variant="ghost" onClick={() => setDismissed(true)}>Not now</Button>
        </div>
      </div>
    </div>
  );
}