import React from 'react';
import { CheckCircle2, Home } from 'lucide-react';
import { Link } from 'react-router-dom';
import Logo from '@/components/Logo';

export default function AccountDeleted() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <Logo className="mb-8" />
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-raised">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-success/10">
          <CheckCircle2 className="h-8 w-8 text-success" />
        </div>
        <h1 className="text-xl font-bold">Your account has been permanently deleted</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          All data linked to your account — your collection, trades, posts, binders, reputation, and
          federated records — has been irrevocably erased.
        </p>
        <p className="mt-3 text-sm text-muted-foreground">
          Your username has been released and your email address can be used to register again in the
          future, should you choose to return to SwapPulse.
        </p>
        <Link
          to="/"
          className="mt-6 inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <Home className="h-4 w-4" /> Back to home
        </Link>
      </div>
    </div>
  );
}