import React, { useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Loader2, ArrowLeft, Send, Bell, BellRing, Flag } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import PageHeader from '@/components/PageHeader';
import Avatar from '@/components/Avatar';
import { useRealtimeEvent } from '@/hooks/useRealtimeEvent';
import { ensureUserDid, stampRecord, NSID } from '@/lib/atproto';
import { unbridgeRecord } from '@/lib/atprotoRecords';
import { TRADE_STATUS_LABELS } from '@/lib/format';
import TradeFairnessCalculator from '@/components/trade/TradeFairnessCalculator';
import TradeFeedbackForm from '@/components/trade/TradeFeedbackForm';
import TradeDisputeForm from '@/components/trade/TradeDisputeForm';
import RichText from '@/components/RichText';

// Live negotiation thread for a trade listing - §9.1 trade.message consumer.
export default function TradeThread() {
  const { tradeId } = useParams();
  const [trade, setTrade] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [me, setMe] = useState(null);
  const endRef = useRef(null);
  const [statusBusy, setStatusBusy] = useState(false);
  const [watching, setWatching] = useState(false);
  const [watchBusy, setWatchBusy] = useState(false);
  const [showDispute, setShowDispute] = useState(false);
  const [alreadyDisputed, setAlreadyDisputed] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [t, m, u, watches] = await Promise.all([
          base44.entities.TradeListing.get(tradeId).catch(() => null),
          base44.entities.TradeMessage.filter({ trade_id: tradeId }, 'created_date', 200).catch(() => []),
          base44.auth.me().catch(() => null),
          base44.entities.TradeWatch.filter({ trade_id: tradeId }).catch(() => []),
        ]);
        setTrade(t);
        setMessages(m);
        setMe(u);
        setWatching(watches.length > 0);
        if (u) {
          const myDisputes = await base44.entities.TradeDispute.filter({ trade_id: tradeId }).catch(() => []);
          setAlreadyDisputed(myDisputes.some((d) => d.created_by_id === u.id));
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [tradeId]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages.length]);

  // §9.1 live: append incoming messages for this thread only.
  const hasMsg = (prev, m) => prev.some((x) => (m.id && x.id === m.id) || (x.body === m.body && x.did === m.did));

  useRealtimeEvent('trade.message', (m) => {
    if (m.trade_id !== tradeId) return;
    setMessages((prev) => (hasMsg(prev, m) ? prev : [...prev, m]));
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
        listing_author_id: trade?.created_by_id || '',
      }, NSID.TRADE_NEGOTIATION, did, signingKey);
      const created = await base44.entities.TradeMessage.create(stamped);
      setMessages((prev) => (hasMsg(prev, created) ? prev : [...prev, created]));
      setBody('');
    } catch (e) {
      alert('Could not send: ' + e.message);
    } finally {
      setSending(false);
    }
  };

  const isOwner = !!me && !!trade && trade.created_by_id === me.id;
  const advanceMap = { open: 'pending_ship', negotiating: 'pending_ship', pending_ship: 'completed' };
  const nextStatus = advanceMap[trade?.status];
  const advanceLabel = { pending_ship: 'Mark Pending Ship', completed: 'Mark Completed' }[nextStatus];
  const statusBadgeClass = {
    open: 'bg-secondary text-foreground',
    negotiating: 'bg-accent/20 text-accent',
    pending_ship: 'bg-primary/15 text-primary',
    completed: 'bg-success/15 text-success',
    cancelled: 'bg-destructive/15 text-destructive',
  }[trade?.status] || 'bg-secondary text-foreground';

  const updateStatus = async (status) => {
    setStatusBusy(true);
    try {
      // Remove the federated copy from the PDS when a trade is cancelled
      if (status === 'cancelled' && trade?.bridged) {
        await unbridgeRecord(trade);
      }
      const updated = await base44.entities.TradeListing.update(trade.id, { status, ...(status === 'cancelled' ? { bridged: false } : {}) });
      setTrade(updated);
    } catch (e) {
      alert('Could not update status: ' + e.message);
    } finally {
      setStatusBusy(false);
    }
  };

  const toggleWatch = async () => {
    setWatchBusy(true);
    try {
      if (watching) {
        const existing = await base44.entities.TradeWatch.filter({ trade_id: tradeId });
        for (const w of existing) await base44.entities.TradeWatch.delete(w.id);
        setWatching(false);
      } else {
        await base44.entities.TradeWatch.create({ trade_id: tradeId });
        setWatching(true);
      }
    } catch (e) {
      alert('Could not update watch status: ' + e.message);
    } finally {
      setWatchBusy(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Negotiation"
        subtitle={trade ? `${trade.offer_card_names?.join(', ') || '-'} → ${trade.wanted_card_names?.join(', ') || '-'}` : ''}
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
            {!isOwner && !['completed', 'cancelled'].includes(trade.status) && (
              <div className="mt-3 flex items-center gap-2 border-t border-border pt-3">
                <button onClick={toggleWatch} disabled={watchBusy} className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold disabled:opacity-50 ${watching ? 'bg-accent/20 text-accent' : 'bg-primary text-white hover:bg-primary/90'}`}>
                  {watching ? <BellRing className="h-3.5 w-3.5" /> : <Bell className="h-3.5 w-3.5" />}
                  {watching ? 'Watching' : 'Watch this trade'}
                </button>
                <span className="text-xs text-muted-foreground">Get notified on updates and completion.</span>
              </div>
            )}
            {me && ['pending_ship', 'completed'].includes(trade.status) && (
              <div className="mt-3 flex items-center gap-2 border-t border-border pt-3">
                {alreadyDisputed ? (
                  <span className="flex items-center gap-1.5 rounded-full bg-destructive/10 px-3 py-1.5 text-xs font-bold text-destructive">
                    <Flag className="h-3.5 w-3.5" /> Dispute filed
                  </span>
                ) : (
                  <button onClick={() => setShowDispute(true)} className="flex items-center gap-1.5 rounded-full border border-destructive/30 px-3 py-1.5 text-xs font-bold text-destructive hover:bg-destructive/10">
                    <Flag className="h-3.5 w-3.5" /> Report a Dispute
                  </button>
                )}
                <span className="text-xs text-muted-foreground">Flag for moderation if something went wrong with the cards.</span>
              </div>
            )}
            {isOwner && (
              <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
                <span className="text-xs font-semibold uppercase text-muted-foreground">Status</span>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${statusBadgeClass}`}>{TRADE_STATUS_LABELS[trade.status] || trade.status}</span>
                {nextStatus && (
                  <button onClick={() => updateStatus(nextStatus)} disabled={statusBusy} className="rounded-full bg-primary px-3 py-1.5 text-xs font-bold text-white hover:bg-primary/90 disabled:opacity-50">
                    {advanceLabel}
                  </button>
                )}
                {!['completed', 'cancelled'].includes(trade.status) && (
                  <button onClick={() => updateStatus('cancelled')} disabled={statusBusy} className="rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-secondary disabled:opacity-50">
                    Cancel trade
                  </button>
                )}
              </div>
            )}
          </div>

          {trade.status === 'completed' && (
            <div className="border-b border-border p-4">
              <TradeFeedbackForm trade={trade} me={me} messages={messages} />
            </div>
          )}

          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {messages.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                Start the conversation - ask about condition, shipping, or terms.
              </p>
            ) : messages.map((m) => {
              const mine = me && (m.did === me.did || m.author_name === me.full_name);
              return (
                <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${mine ? 'bg-primary text-white' : 'bg-secondary'}`}>
                    {!mine && <p className="mb-0.5 text-xs font-semibold text-muted-foreground">{m.author_name}</p>}
                    <RichText text={m.body} className="whitespace-pre-wrap break-words" linkClassName={mine ? 'font-medium text-primary-foreground hover:underline' : 'font-medium text-primary hover:underline'} />
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

      {showDispute && (
        <TradeDisputeForm
          trade={trade}
          me={me}
          open={showDispute}
          onClose={() => setShowDispute(false)}
          onFiled={() => setAlreadyDisputed(true)}
        />
      )}
    </div>
  );
}