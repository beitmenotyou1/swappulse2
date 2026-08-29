import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Heart, ArrowLeft, Home, Loader2, AlertTriangle } from 'lucide-react';
import Logo from '@/components/Logo';
import { base44 } from '@/api/base44Client';
import useSEO from '@/hooks/useSEO';

export default function FiatSuccess() {
  const [params] = useSearchParams();
  const sessionId = params.get('session_id') || '';
  const [state, setState] = useState({ status: 'verifying', message: 'Confirming your payment with Stripe…', amount: null });

  useSEO({
    title: state.status === 'verified' ? 'Donation Complete' : 'Donation Verification',
    description: 'Securely verify your SwapPulse card donation with Stripe.',
    canonicalPath: '/donate/fiat-success',
  });

  useEffect(() => {
    let cancelled = false;
    if (!sessionId) {
      setState({ status: 'error', message: 'This page is missing the Stripe checkout reference. Your payment has not been marked as confirmed here.', amount: null });
      return undefined;
    }
    base44.functions.invoke('verify-fiat-donation-session', { sessionId })
      .then((res) => {
        if (cancelled) return;
        const data = res?.data ?? res;
        if (data?.verified) {
          setState({ status: 'verified', message: 'Stripe has confirmed your donation. Thank you for supporting SwapPulse.', amount: data.amount });
        } else {
          setState({ status: 'pending', message: 'Stripe has not confirmed this payment as paid yet. If you were charged, check again shortly or contact support.', amount: null });
        }
      })
      .catch((error) => {
        if (!cancelled) setState({ status: 'error', message: error?.response?.data?.error || error?.message || 'We could not verify this payment with Stripe.', amount: null });
      });
    return () => { cancelled = true; };
  }, [sessionId]);

  const verified = state.status === 'verified';
  const verifying = state.status === 'verifying';

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <Link to="/" className="flex items-center gap-2">
          <Logo size={28} withText={false} />
          <span className="font-extrabold">SwapPulse</span>
        </Link>
        <Link to="/" className="flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to SwapPulse
        </Link>
      </header>

      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center px-4 text-center" aria-live="polite">
        <span className={`mb-4 grid h-16 w-16 place-items-center rounded-full ${verified ? 'bg-success/15 text-success' : verifying ? 'bg-primary/15 text-primary' : 'bg-warning/15 text-warning'}`}>
          {verifying ? <Loader2 className="h-8 w-8 animate-spin" /> : verified ? <Heart className="h-8 w-8 fill-current" /> : <AlertTriangle className="h-8 w-8" />}
        </span>
        <h1 className="text-2xl font-extrabold">
          {verified ? 'Donation confirmed' : verifying ? 'Verifying donation' : 'Payment not confirmed'}
        </h1>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">{state.message}</p>
        {verified && Number.isFinite(state.amount) && (
          <p className="mt-3 text-lg font-bold">£{Number(state.amount).toFixed(2)}</p>
        )}
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link to="/" className="flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-bold text-white hover:bg-primary/90">
            <Home className="h-4 w-4" /> Back to SwapPulse
          </Link>
          {!verified && !verifying && (
            <Link to="/donate" className="rounded-full border border-border px-6 py-3 text-sm font-bold hover:bg-secondary">
              Return to donations
            </Link>
          )}
        </div>
      </main>
    </div>
  );
}
