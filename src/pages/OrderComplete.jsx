import React from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';

// Public order-confirmation page — the Wix checkout thankYouPageUrl points here.
// No auth required: a buyer may not have a SwapPulse account.
export default function OrderComplete() {
  return (
    <div className="flex min-h-[80vh] flex-col items-center justify-center px-4 text-center">
      <div className="rounded-full bg-success/15 p-4">
        <CheckCircle2 className="h-12 w-12 text-success" />
      </div>
      <h1 className="mt-6 text-2xl font-extrabold tracking-tight">Order complete</h1>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        Thanks for your purchase. The seller will be notified and your order is now being processed.
      </p>
      <Link
        to="/"
        className="mt-6 rounded-full bg-primary px-6 py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary/90"
      >
        Back to SwapPulse
      </Link>
    </div>
  );
}