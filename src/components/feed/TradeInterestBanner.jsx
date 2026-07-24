import React, { useEffect, useState } from 'react';
import { Handshake, X } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import Avatar from '@/components/Avatar';

export default function TradeInterestBanner() {
  const [data, setData] = useState(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await base44.functions.invoke('getTradeInterest', {});
        setData(res.data);
      } catch {
        setData(null);
      }
    })();
  }, []);

  if (!data?.count || dismissed) return null;

  return (
    <div className="m-4 rounded-2xl border border-primary/30 bg-primary/5 p-3">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 text-sm font-bold">
          <Handshake className="h-4 w-4 text-primary" /> Trade Interest ({data.count})
        </h3>
        <button onClick={() => setDismissed(true)} className="text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-2 space-y-1.5">
        {data.interests.slice(0, 4).map((i) => (
          <div key={i.id} className="flex items-center gap-2 text-xs">
            <Avatar name={i.reactor_name} size={24} />
            <span className="font-semibold">{i.reactor_name}</span>
            <span className="text-muted-foreground">
              wants{i.card_name ? ` ${i.card_name}` : ' your card'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}