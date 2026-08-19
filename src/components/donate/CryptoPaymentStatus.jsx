import React, { useState, useEffect, useRef } from 'react';
import { CheckCircle2, XCircle, Clock } from 'lucide-react';
import { base44 } from '@/api/base44Client';

const TERMINAL = ['finished', 'failed', 'expired'];

export default function CryptoPaymentStatus({ paymentId }) {
  const [status, setStatus] = useState('waiting');
  const timerRef = useRef(null);

  useEffect(() => {
    let active = true;
    const poll = async () => {
      try {
        const res = await base44.functions.invoke('get-crypto-donation-status', { paymentId });
        const data = res?.data ?? res;
        if (active && data?.paymentStatus) setStatus(data.paymentStatus);
      } catch {
        /* keep last known status on transient errors */
      }
    };
    poll();
    timerRef.current = setInterval(poll, 5000);
    return () => {
      active = false;
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [paymentId]);

  useEffect(() => {
    if (TERMINAL.includes(status) && timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, [status]);

  const isFinished = status === 'finished';
  const isFailed = status === 'failed' || status === 'expired';

  return (
    <div
      className={`mt-4 flex items-center gap-3 rounded-xl border p-3 ${
        isFinished
          ? 'border-success/30 bg-success/10'
          : isFailed
            ? 'border-destructive/30 bg-destructive/10'
            : 'border-border bg-background'
      }`}
    >
      {isFinished ? (
        <CheckCircle2 className="h-5 w-5 shrink-0 text-success" />
      ) : isFailed ? (
        <XCircle className="h-5 w-5 shrink-0 text-destructive" />
      ) : (
        <Clock className="h-5 w-5 shrink-0 animate-pulse text-primary" />
      )}
      <div>
        <p className="text-sm font-bold capitalize">
          {isFinished ? 'Payment received' : isFailed ? 'Payment failed' : 'Waiting for payment'}
        </p>
        <p className="text-xs text-muted-foreground">
          {isFinished
            ? 'Thank you! Your donation has been confirmed.'
            : isFailed
              ? 'This payment expired or failed. You can start over.'
              : `Status: ${status}. We check every 5 seconds.`}
        </p>
      </div>
    </div>
  );
}