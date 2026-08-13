import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { LogIn, X } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';

export default function SignInBanner() {
  const { isAuthenticated } = useAuth();
  const [dismissed, setDismissed] = useState(false);
  if (isAuthenticated || dismissed) return null;
  return (
    <div className="flex items-center justify-between gap-2 border-b border-primary/20 bg-primary/5 px-4 py-2 text-sm">
      <p className="text-muted-foreground">
        <LogIn className="mr-1.5 inline h-4 w-4 text-primary" aria-hidden="true" />
        Browsing as a guest —{' '}
        <Link to="/login" className="font-semibold text-primary hover:underline">Log in</Link>
        {' '}to post, trade, and interact.
      </p>
      <button
        onClick={() => setDismissed(true)}
        aria-label="Dismiss"
        className="shrink-0 text-muted-foreground hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}