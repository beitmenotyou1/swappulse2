import React from 'react';
import { Lightbulb } from 'lucide-react';

const TIPS = [
  'Good, even lighting without glare',
  'Flat, straight-on angle',
  'Remove sleeves if possible',
  'Clear, in-focus image',
];

export default function ScanTips() {
  return (
    <div className="mt-4 rounded-xl border border-border bg-secondary/50 p-4 text-left">
      <div className="mb-2 flex items-center gap-2">
        <Lightbulb className="h-4 w-4 text-accent" />
        <h3 className="text-sm font-semibold">Tips for best results</h3>
      </div>
      <ul className="space-y-1 text-xs text-muted-foreground">
        {TIPS.map((t) => (
          <li key={t}>• {t}</li>
        ))}
      </ul>
    </div>
  );
}