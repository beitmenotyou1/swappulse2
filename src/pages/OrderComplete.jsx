import React from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';

export default function OrderComplete() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-6 text-center">
      <div className="grid h-16 w-16 place-items-center rounded-full bg-success/15">
        <CheckCircle2 className="h-9 w-9 text-success" />
      </div>
      <h1 className="mt-4 text-2xl font-extrabold">Payment received</h1>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        Thanks for your purchase. The seller has been notified and your order is being processed.
      </p>
      <div className="mt-6 flex gap-2">
        <Link to="/marketplace" className="rounded-full bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-primary/90">
          Back to Marketplace
        </Link>
        <Link to="/" className="rounded-full border border-border px-4 py-2 text-sm font-semibold hover:bg-secondary">
          Home
        </Link>
      </div>
    </div>
  );
}