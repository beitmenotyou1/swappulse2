import React, { useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Loader2, ArrowLeft, Send } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import PageHeader from '@/components/PageHeader';
import Avatar from '@/components/Avatar';
import { useRealtimeEvent } from '@/hooks/useRealtimeEvent';
import { ensureUserDid, stampRecord, NSID } from '@/lib/atproto';
import { TRADE_STATUS_LABELS } from '@/lib/format';
import TradeFairnessCalculator from '@/components/trade/TradeFairnessCalculator';

// Live negotiation thread for a trade listing — §9.1 trade.message consumer.
export default function TradeThread() {
  const { tradeId } = useParams();
  const [trade, setTrade] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [me, setMe] = useState(null);
  const endRef = useRef(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [t, m, u] = await Promise.all([
          base44.entities.TradeListing.get(tradeId).catch(() => null),
          base44.entities.TradeMessage.filter({ trade_id: tradeId }, 'created_date', 200).catch(() => []),
          base44.auth.me().catch(() => null),
        ]);
        setTrade(t);
        setMessages(m);
        setMe(u);
      } finally {
        setLoading(false);
      }
    })();
  }, [tradeId]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages.length]);

  // §9.1 live: append incoming messages for this thread only.
  useRealtimeEvent('trade.message', (m) => {
    if (m.trade_id !== tradeId) return;
    setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
  });

  const send = async () => {
    const text = body.trim();
    if (!text) return;
    setSending(true);
    try {
      const { did, signingKey } = await ensureUserDid();
      const stamped = await stampRecord({
        trade_id: tradeId,
        body: text,
        author_name: me?.full_name || 'Collector',
        author_handle: me?.email?.split('@')[0] || 'collector',
        author_avatar: '',
      }, NSID.TRADE_NEGOTIATION, did, signingKey);
      const created = await base44.entities.TradeMessage.create(stamped);
      setMessages((prev) => (prev.some((x) => x.id === created.id) ? prev : [...prev, created]));
      setBody('');
    } catch (e) {
      alert('Could not send: ' + e.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Negotiation"
        subtitle={trade ? `${trade.offer_card_names?.join(', ') || '—'} → ${trade.wanted_card_names?.join(', ') || '—'}` : ''}
      >
        <Link to="/trades" className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Board
        </Link>
      </PageHeader>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : !trade ? (
        <div className="px-4 py-20 text-center">
          <p className="text-lg font-bold">Trade not found</p>
          <Link to="/trades" className="mt-2 inline-block text-sm text-primary">Back to Trade Board</Link>
        </div>
      ) : (
        <div className="flex flex-col" style={{ minHeight: 'calc(100vh - 120px)' }}>
          <div className="border-b border-border p-4">
            <div className="flex items-center gap-2">
              <Avatar name={trade.author_name} src={trade.author_avatar} size={32} />
              <span className="text-sm font-semibold">{trade.author_name || 'Collector'}</span>
              <span className="text-xs text-muted-foreground">· {TRADE_STATUS_LABELS[trade.status] || trade.status}</span>
            </div>
            <div className="mt-3">
              <TradeFairnessCalculator trade={trade} />
            </div>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {messages.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                Start the conversation — ask about condition, shipping, or terms.
              </p>
            ) : messages.map((m) => {
              const mine = me && (m.did === me.did || m.author_name === me.full_name);
              return (
                <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${mine ? 'bg-primary text-white' : 'bg-secondary'}`}>
                    {!mine && <p className="mb-0.5 text-xs font-semibold text-muted-foreground">{m.author_name}</p>}
                    <p className="whitespace-pre-wrap break-words">{m.body}</p>
                  </div>
                </div>
              );
            })}
            <div ref={endRef} />
          </div>

          <div className="sticky bottom-0 border-t border-border bg-background/95 p-3 backdrop-blur">
            <div className="flex items-end gap-2">
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={1}
                placeholder="Message…"
                className="flex-1 resize-none rounded-2xl border border-border bg-secondary px-3 py-2 text-sm outline-none focus:border-primary"
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
              />
              <button onClick={send} disabled={sending || !body.trim()} className="rounded-full bg-primary p-2.5 text-white disabled:opacity-50">
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}