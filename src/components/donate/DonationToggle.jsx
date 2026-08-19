import React from 'react';
import { CreditCard, Bitcoin } from 'lucide-react';

export default function DonationToggle({ method, onChange }) {
  return (
    <div role="group" aria-label="Payment method" className="grid grid-cols-2 gap-2 rounded-full border border-border bg-secondary p-1">
      <button
        type="button"
        onClick={() => onChange('card')}
        aria-pressed={method === 'card'}
        className="flex cursor-pointer items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold transition-colors hover:bg-secondary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        style={method === 'card' ? { background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' } : {}}
      >
        <CreditCard className="h-4 w-4" /> Card (Fiat)
      </button>
      <button
        type="button"
        onClick={() => onChange('crypto')}
        aria-pressed={method === 'crypto'}
        className="flex cursor-pointer items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold transition-colors hover:bg-secondary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        style={method === 'crypto' ? { background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' } : {}}
      >
        <Bitcoin className="h-4 w-4" /> Cryptocurrency
      </button>
    </div>
  );
}