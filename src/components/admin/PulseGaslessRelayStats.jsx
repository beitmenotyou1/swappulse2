import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Zap, Loader2 } from 'lucide-react';

// Shows the PulseChain gasless relay status inside the admin PulseChain
// Treasury section: whether the relay is deployed (and its address), how many
// gasless transfers are queued vs. relayed, and a note that the relayer PLS is
// auto-replenished via PulseX. Admin-only (the entity reads require admin).
export default function PulseGaslessRelayStats() {
  const [relay, setRelay] = useState(null);
  const [pending, setPending] = useState(0);
  const [processed, setProcessed] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [relayRecs, pendingRecs, processedRecs] = await Promise.all([
          base44.entities.ContractRegistry.filter({ contract_key: 'pulse_meta_relay' }).catch(() => []),
          base44.entities.MetaTransaction.filter({ chain: 'pulse', status: 'pending' }).catch(() => []),
          base44.entities.MetaTransaction.filter({ chain: 'pulse', status: 'processed' }).catch(() => []),
        ]);
        if (cancelled) return;
        setRelay(relayRecs[0] || null);
        setPending(pendingRecs.length);
        setProcessed(processedRecs.length);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return <div className="flex justify-center py-3"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>;
  }

  const deployed = !!relay;

  return (
    <div className="mb-4 rounded-lg border border-border bg-secondary/30 p-3">
      <div className="mb-2 flex items-center gap-1.5">
        <Zap className="h-4 w-4 text-primary" />
        <p className="text-xs font-semibold">Gasless Relay</p>
        <span className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-semibold ${deployed ? 'bg-success/15 text-success' : 'bg-warning/15 text-warning'}`}>
          {deployed ? 'Deployed' : 'Not deployed'}
        </span>
      </div>
      {deployed ? (
        <>
          <p className="truncate font-mono text-[10px] text-muted-foreground">{relay.address}</p>
          <div className="mt-2 flex gap-4 text-xs">
            <span><span className="font-semibold">{pending}</span> <span className="text-muted-foreground">queued</span></span>
            <span><span className="font-semibold">{processed}</span> <span className="text-muted-foreground">relayed</span></span>
          </div>
          <p className="mt-1.5 text-[10px] text-muted-foreground">Relayer PLS auto-replenished via PulseX every 10 min.</p>
        </>
      ) : (
        <p className="text-[10px] text-muted-foreground">An admin must run <span className="font-mono">deploy-pulse-relay</span> to enable gasless $PULSE transfers.</p>
      )}
    </div>
  );
}