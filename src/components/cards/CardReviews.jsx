import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, Star, Send } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { variantLabel } from '@/lib/format';
import Avatar from '@/components/Avatar';
import { ensureUserDid, stampRecord, NSID } from '@/lib/atproto';
import { bridgeCardReview } from '@/lib/federatedBridge';
import RecommendButton from '@/components/standard/RecommendButton';

// §4.3 Community Card Reviews - four-dimension rating (artwork, playability,
// collectibility, investment) 1-5 each, plus optional review text + variant.
// Aggregate averages shown at top; individual reviews listed below.

const DIMENSIONS = [
  { key: 'artwork', label: 'Artwork' },
  { key: 'playability', label: 'Playability' },
  { key: 'collectibility', label: 'Collectibility' },
  { key: 'investment', label: 'Investment' },
];

const VARIANTS = ['normal', 'holo', 'reverse_holo'];

function StarRow({ value, onChange, disabled }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={disabled}
          onClick={() => onChange(n)}
          className={`p-0.5 ${disabled ? 'cursor-default' : 'hover:scale-110'} transition`}
          aria-label={`${n} star${n > 1 ? 's' : ''}`}
        >
          <Star className={`h-4 w-4 ${n <= value ? 'fill-accent text-accent' : 'text-muted-foreground/40'}`} />
        </button>
      ))}
    </div>
  );
}

function avg(reviews, key) {
  const vals = reviews.map((r) => r[key]).filter((n) => typeof n === 'number');
  if (!vals.length) return null;
  return vals.reduce((s, n) => s + n, 0) / vals.length;
}

export default function CardReviews({ card }) {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [me, setMe] = useState(null);
  const [form, setForm] = useState({ artwork: 5, playability: 5, collectibility: 5, investment: 5, review_text: '', variant: 'normal' });
  const [error, setError] = useState('');

  const cardId = card?.id;

  const load = async () => {
    if (!cardId) return;
    setLoading(true);
    try {
      const [r, u] = await Promise.all([
        base44.entities.CardReview.filter({ card_id: cardId }, '-created_date', 100).catch(() => []),
        base44.auth.me().catch(() => null),
      ]);
      setReviews(r);
      setMe(u);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [cardId]);

  const aggregates = useMemo(() => {
    const out = {};
    for (const d of DIMENSIONS) out[d.key] = avg(reviews, d.key);
    return out;
  }, [reviews]);

  const overallAvg = useMemo(() => {
    const vals = Object.values(aggregates).filter((n) => n != null);
    if (!vals.length) return null;
    return vals.reduce((s, n) => s + n, 0) / vals.length;
  }, [aggregates]);

  const myReview = useMemo(() => {
    if (!me) return null;
    return reviews.find((r) => r.did === me.did || r.author_name === me.full_name);
  }, [reviews, me]);

  const submit = async () => {
    setError('');
    if (!form.review_text.trim() && form.artwork + form.playability + form.collectibility + form.form === 20 && false) {
      // ratings alone are fine
    }
    setSubmitting(true);
    try {
      const { did, signingKey } = await ensureUserDid();
      const stamped = await stampRecord({
        card_id: cardId,
        card_name: card.name,
        card_image: card.image || '',
        artwork: form.artwork,
        playability: form.playability,
        collectibility: form.collectibility,
        investment: form.investment,
        review_text: form.review_text.trim(),
        variant: form.variant,
        author_name: me?.full_name || 'Collector',
        author_handle: me?.email?.split('@')[0] || 'collector',
      }, NSID.CARD_REVIEW, did, signingKey);
      const created = await base44.entities.CardReview.create(stamped);
      bridgeCardReview(stamped).then((res) => {
        if (res.bridged) base44.entities.CardReview.update(created.id, res).catch(() => {});
      }).catch(() => {});
      // Publish as a site.standard.document for interoperable long-form
      // discovery (reviews with text only — rating-only reviews are too short).
      if (form.review_text.trim()) {
        base44.functions.invoke('publish-standard-document', {
          entityType: 'card_review',
          entityId: created.id,
          title: `${card.name} Review`,
          path: `/card/${cardId}`,
          description: form.review_text.trim(),
          coverImageUrl: card.image || '',
          tags: [card.name, card.set?.name].filter(Boolean),
          textContent: form.review_text.trim(),
          publishedAt: new Date().toISOString(),
          authorName: stamped.author_name,
          authorHandle: stamped.author_handle,
        }).then((res) => {
          const data = res?.data ?? res;
          if (data?.documentUri) {
            base44.entities.CardReview.update(created.id, {
              standard_doc_uri: data.documentUri,
              standard_pub_uri: data.authorPubUri,
            }).catch(() => {});
          }
        }).catch((e) => console.error('standard.site review publish failed', e));
      }
      setReviews((prev) => [created, ...prev.filter((r) => r.id !== created.id)]);
      setForm({ artwork: 5, playability: 5, collectibility: 5, investment: 5, review_text: '', variant: 'normal' });
    } catch (e) {
      setError('Could not submit review: ' + e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mt-5 rounded-2xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-bold">Community Reviews</h3>
        <span className="text-xs text-muted-foreground">{reviews.length} review{reviews.length === 1 ? '' : 's'}</span>
      </div>

      {/* Aggregate averages */}
      {loading ? (
        <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
      ) : reviews.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">No reviews yet - be the first to rate this card.</p>
      ) : (
        <div className="mb-4 rounded-xl border border-border bg-secondary p-3">
          {overallAvg != null && (
            <div className="mb-2 flex items-center gap-2">
              <span className="text-2xl font-extrabold">{overallAvg.toFixed(1)}</span>
              <div className="flex">
                {[1, 2, 3, 4, 5].map((n) => (
                  <Star key={n} className={`h-4 w-4 ${n <= Math.round(overallAvg) ? 'fill-accent text-accent' : 'text-muted-foreground/40'}`} />
                ))}
              </div>
              <span className="text-xs text-muted-foreground">overall</span>
            </div>
          )}
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-4">
            {DIMENSIONS.map((d) => (
              <div key={d.key} className="flex items-center justify-between gap-1.5">
                <span className="text-[11px] text-muted-foreground">{d.label}</span>
                <span className="text-xs font-bold">{aggregates[d.key] != null ? aggregates[d.key].toFixed(1) : '-'}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Review form */}
      <div className="mb-4 rounded-xl border border-border bg-secondary/50 p-3">
        <p className="mb-2 text-xs font-semibold text-muted-foreground">{myReview ? 'Your review' : 'Rate this card'}</p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
          {DIMENSIONS.map((d) => (
            <div key={d.key}>
              <p className="mb-0.5 text-[11px] text-muted-foreground">{d.label}</p>
              <StarRow value={form[d.key]} onChange={(n) => setForm((f) => ({ ...f, [d.key]: n }))} />
            </div>
          ))}
        </div>
        <div className="mt-2 flex gap-2">
          <select
            value={form.variant}
            onChange={(e) => setForm((f) => ({ ...f, variant: e.target.value }))}
            className="rounded-lg border border-border bg-secondary px-2 py-1.5 text-xs outline-none"
          >
            {VARIANTS.map((v) => <option key={v} value={v}>{variantLabel(v)}</option>)}
          </select>
        </div>
        <textarea
          value={form.review_text}
          onChange={(e) => setForm((f) => ({ ...f, review_text: e.target.value }))}
          rows={2}
          maxLength={2000}
          placeholder="Share your thoughts (optional)…"
          className="mt-2 w-full resize-none rounded-lg border border-border bg-secondary px-3 py-2 text-sm outline-none focus:border-primary"
        />
        {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
        <button
          onClick={submit}
          disabled={submitting}
          className="mt-2 flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-bold text-white hover:bg-primary/90 disabled:opacity-50"
        >
          {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          {myReview ? 'Update Review' : 'Post Review'}
        </button>
      </div>

      {/* Individual reviews */}
      <div className="space-y-3">
        {reviews.slice(0, 10).map((r) => (
          <div key={r.id} className="rounded-xl border border-border bg-secondary/40 p-3">
            <div className="flex items-center gap-2">
              <Avatar name={r.author_name} size={28} />
              <span className="text-sm font-semibold">{r.author_name || 'Collector'}</span>
              <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground">{variantLabel(r.variant)}</span>
              <div className="ml-auto flex">
                {[1, 2, 3, 4, 5].map((n) => (
                  <Star key={n} className={`h-3 w-3 ${n <= Math.round([r.artwork, r.playability, r.collectibility, r.investment].reduce((s, x) => s + (x || 0), 0) / 4) ? 'fill-accent text-accent' : 'text-muted-foreground/30'}`} />
                ))}
              </div>
            </div>
            <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5">
              {DIMENSIONS.map((d) => (
                <span key={d.key} className="text-[10px] text-muted-foreground">{d.label}: <span className="font-bold text-foreground">{r[d.key] ?? '-'}</span></span>
              ))}
            </div>
            {r.review_text && <p className="mt-1.5 text-sm text-foreground/90">{r.review_text}</p>}
            {r.standard_doc_uri && (
              <div className="mt-2">
                <RecommendButton
                  documentUri={r.standard_doc_uri}
                  entityType="card_review"
                  entityId={r.id}
                  authorDid={r.did || ''}
                  initialCount={r.recommend_count || 0}
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}