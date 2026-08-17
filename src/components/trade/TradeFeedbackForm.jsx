import React, { useEffect, useState } from 'react';
import { Star, Loader2, CheckCircle2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { ensureUserDid, stampRecord, NSID } from '@/lib/atproto';

export default function TradeFeedbackForm({ trade, me, messages }) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [myDid, setMyDid] = useState('');
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { did } = await ensureUserDid();
        setMyDid(did);
        const existing = await base44.entities.Reputation.filter({
          rater_did: did,
          trade_uri: trade.at_uri || trade.id,
        });
        if (existing.length > 0) setSubmitted(true);
      } catch {} finally {
        setChecking(false);
      }
    })();
  }, [trade.id, trade.at_uri]);

  // Determine the counterparty: if I'm the owner, find the other participant from messages;
  // otherwise the counterparty is the trade owner.
  const isOwner = me && trade.created_by_id === me.id;
  const otherMsg = messages.find((m) => m.did && m.did !== myDid);
  const counterpartyDid = isOwner ? otherMsg?.did : trade.did;
  const counterpartyName = isOwner ? otherMsg?.author_name : trade.author_name;

  if (checking) return null;
  if (trade.status !== 'completed') return null;
  if (!counterpartyDid) return null;

  if (submitted) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-success/30 bg-success/10 p-3 text-sm">
        <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
        <span>Feedback submitted, thanks for building community trust!</span>
      </div>
    );
  }

  const submit = async () => {
    if (rating === 0) return;
    setSubmitting(true);
    try {
      const { did, signingKey } = await ensureUserDid();
      const stamped = await stampRecord({
        did: counterpartyDid,
        rater_did: myDid,
        rater_name: me?.full_name || 'Collector',
        rater_handle: me?.email?.split('@')[0] || 'collector',
        trade_uri: trade.at_uri || trade.id,
        rating,
        comment: comment.trim(),
      }, NSID.TRADING_FEEDBACK, did, signingKey);
      const rep = await base44.entities.Reputation.create(stamped);
      // Bridge to the PDS as a real org.swappulse.tradingFeedback record so the
      // reputation is portable across PDSs and SwapPulse instances. Non-fatal.
      base44.functions.invoke('atproto-bridge', {
        collection: NSID.TRADING_FEEDBACK,
        record: {
          rated_user_did: counterpartyDid,
          rater_did: myDid,
          rater_name: me?.full_name || 'Collector',
          rater_handle: me?.email?.split('@')[0] || 'collector',
          trade_uri: trade.at_uri || trade.id,
          rating,
          comment: comment.trim(),
          createdAt: new Date().toISOString(),
        },
      }).then((res) => {
        const uri = res?.data?.uri || res?.uri;
        const cid = res?.data?.cid || res?.cid;
        if (uri) {
          base44.entities.Reputation.update(rep.id, { at_uri: uri, cid: cid || '', bridged: true }).catch(() => {});
        }
      }).catch(() => {});
      setSubmitted(true);
    } catch (e) {
      alert('Could not submit feedback: ' + e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h3 className="text-sm font-bold">Rate your trade with {counterpartyName || 'this trader'}</h3>
      <p className="mt-0.5 text-xs text-muted-foreground">Share your experience to help others trade with confidence.</p>
      <div className="mt-3 flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setRating(n)}
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
            className="p-0.5"
            aria-label={`${n} star${n > 1 ? 's' : ''}`}
          >
            <Star className={`h-7 w-7 transition-colors ${(hover || rating) >= n ? 'fill-accent text-accent' : 'text-muted-foreground/40'}`} />
          </button>
        ))}
      </div>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        rows={2}
        maxLength={280}
        placeholder="Leave a comment (optional)…"
        className="mt-3 w-full resize-none rounded-lg border border-border bg-secondary px-3 py-2 text-sm outline-none focus:border-primary"
      />
      <button
        onClick={submit}
        disabled={submitting || rating === 0}
        className="mt-3 flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-primary/90 disabled:opacity-50"
      >
        {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
        Submit Feedback
      </button>
    </div>
  );
}