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
import useSEO from '@/hooks/useSEO';
import GuideFooterLink from '@/components/help/GuideFooterLink';
import LabelBadges from '@/components/labelers/LabelBadges';
import LabelContentButton from '@/components/labelers/LabelContentButton';
import { useT } from '@/lib/i18n/I18nProvider';

// Live negotiation thread for a trade listing - §9.1 trade.message consumer.
export default function TradeThread() {
  const t = useT();
  const { tradeId } = useParams();
  useSEO({
    title: 'Trade Thread',
    description: 'Negotiate a Pokémon TCG trade on SwapPulse, threaded trade chat with fairness scoring.',
    canonicalPath: `/trade/${tradeId}`,
  });
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
        const [tradeRes, m, u, watches] = await Promise.all([
          base44.functions.invoke('get-visible-trades', { listing_id: tradeId }).catch(() => null),
          base44.entities.TradeMessage.filter({ trade_id: tradeId }, 'created_date', 200).catch(() => []),
          base44.auth.me().catch(() => null),
          base44.entities.TradeWatch.filter({ trade_id: tradeId }).catch(() => []),
        ]);
        const t = tradeRes?.data?.listing || null;
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
        author_name: me?.display_name || me?.full_name || t('profile.collector'),
        author_handle: me?.username || me?.bsky_handle || 'collector',
        author_avatar: me?.avatar || '',
        listing_author_id: trade?.created_by_id || '',
      }, NSID.TRADE_NEGOTIATION, did, signingKey);
      const created = await base44.entities.TradeMessage.create(stamped);
      setMessages((prev) => (hasMsg(prev, created) ? prev : [...prev, created]));
      setBody('');
    } catch (e) {
      alert(t('tradeThread.sendError') + ': ' + e.message);
    } finally {
      setSending(false);
    }
  };

  const isOwner = !!me && !!trade && trade.created_by_id === me.id;
  const advanceMap = { open: 'pending_ship', negotiating: 'pending_ship', pending_ship: 'completed' };
  const nextStatus = advanceMap[trade?.status];
  const advanceLabel = { pending_ship: t('tradeThread.markPendingShip'), completed: t('tradeThread.markCompleted') }[nextStatus];
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
      alert(t('tradeThread.statusError') + ': ' + e.message);
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
      alert(t('tradeThread.watchError') + ': ' + e.message);
    } finally {
      setWatchBusy(false);
    }
  };

  return (
    <div>
      <PageHeader
        title={t('page.tradeThread.title')}
        subtitle={trade ? `${trade.offer_card_names?.join(', ') || '-'} → ${trade.wanted_card_names?.join(', ') || '-'}` : ''}
      >
        <Link to="/trades" className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> {t('page.tradeThread.board')}
        </Link>
      </PageHeader>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : !trade ? (
        <div className="px-4 py-20 text-center">
          <p className="text-lg font-bold">{t('page.tradeThread.notFound')}</p>
          <Link to="/trades" className="mt-2 inline-block text-sm text-primary">{t('page.tradeThread.backToBoard')}</Link>
        </div>
      ) : (
        <div className="flex flex-col" style={{ minHeight: 'calc(100vh - 120px)' }}>
          <div className="border-b border-border p-4">
            <div className="flex items-center gap-2">
              <Avatar name={trade.author_name} src={trade.author_avatar} size={32} />
              <span className="text-sm font-semibold">{trade.author_name || t('profile.collector')}</span>
              <span className="text-xs text-muted-foreground">· {TRADE_STATUS_LABELS[trade.status] || trade.status}</span>
            </div>
            <div className="mt-3">
              <TradeFairnessCalculator trade={trade} />
            </div>
            <LabelBadges subjectUri={trade.at_uri || trade.id} size="md" className="mt-3" />
            {!isOwner && !['completed', 'cancelled'].includes(trade.status) && (
              <div className="mt-3 flex items-center gap-2 border-t border-border pt-3">
                <button onClick={toggleWatch} disabled={watchBusy} className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold disabled:opacity-50 ${watching ? 'bg-accent/20 text-accent' : 'bg-primary text-white hover:bg-primary/90'}`}>
                  {watching ? <BellRing className="h-3.5 w-3.5" /> : <Bell className="h-3.5 w-3.5" />}
                  {watching ? t('tradeThread.watching') : t('tradeThread.watchTrade')}
                </button>
                <LabelContentButton subjectUri={trade.at_uri || trade.id} subjectType="trade_listing" />
                <span className="text-xs text-muted-foreground">{t('tradeThread.watchSub')}</span>
              </div>
            )}
            {me && ['pending_ship', 'completed'].includes(trade.status) && (
              <div className="mt-3 flex items-center gap-2 border-t border-border pt-3">
                {alreadyDisputed ? (
                  <span className="flex items-center gap-1.5 rounded-full bg-destructive/10 px-3 py-1.5 text-xs font-bold text-destructive">
                    <Flag className="h-3.5 w-3.5" /> {t('tradeThread.disputeFiled')}
                  </span>
                ) : (
                  <button onClick={() => setShowDispute(true)} className="flex items-center gap-1.5 rounded-full border border-destructive/30 px-3 py-1.5 text-xs font-bold text-destructive hover:bg-destructive/10">
                    <Flag className="h-3.5 w-3.5" /> {t('tradeThread.reportDispute')}
                  </button>
                )}
                <span className="text-xs text-muted-foreground">{t('tradeThread.disputeSub')}</span>
              </div>
            )}
            {isOwner && (
              <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
                <span className="text-xs font-semibold uppercase text-muted-foreground">{t('tradeThread.status')}</span>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${statusBadgeClass}`}>{TRADE_STATUS_LABELS[trade.status] || trade.status}</span>
                {nextStatus && (
                  <button onClick={() => updateStatus(nextStatus)} disabled={statusBusy} className="rounded-full bg-primary px-3 py-1.5 text-xs font-bold text-white hover:bg-primary/90 disabled:opacity-50">
                    {advanceLabel}
                  </button>
                )}
                {!['completed', 'cancelled'].includes(trade.status) && (
                  <button onClick={() => updateStatus('cancelled')} disabled={statusBusy} className="rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-secondary disabled:opacity-50">
                    {t('tradeThread.cancelTrade')}
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
                {t('tradeThread.startConversation')}
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
                placeholder={t('tradeThread.messagePlaceholder')}
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
      <GuideFooterLink slug="trade-threads" />
    </div>
  );
}