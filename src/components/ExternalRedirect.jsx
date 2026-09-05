import React, { useEffect } from 'react';
import { ExternalLink, Loader2 } from 'lucide-react';

export default function ExternalRedirect({ to, label = 'Continue' }) {
  useEffect(() => {
    window.location.replace(to);
  }, [to]);

  return (
    <main className="grid min-h-screen place-items-center bg-background px-4 text-foreground">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 text-center shadow-sm">
        <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" aria-hidden="true" />
        <h1 className="mt-4 text-lg font-bold">Opening SwapPulse documentation</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Help content now lives in our GitBook documentation.
        </p>
        <a
          href={to}
          className="mt-5 inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:bg-primary/90"
        >
          {label} <ExternalLink className="h-4 w-4" aria-hidden="true" />
        </a>
      </div>
    </main>
  );
}
