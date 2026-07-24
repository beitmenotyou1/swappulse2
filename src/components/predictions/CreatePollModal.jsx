import React, { useState } from 'react';
import { X, Loader2, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { ensureUserDid, stampRecord, NSID } from '@/lib/atproto';
import CardSearchModal from '@/components/cards/CardSearchModal';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

const DIRS = [
  { key: 'bullish', label: 'Bullish', icon: TrendingUp },
  { key: 'bearish', label: 'Bearish', icon: TrendingDown },
  { key: 'neutral', label: 'Neutral', icon: Minus },
];

const EXPIRIES = [
  { key: '1d', label: '1 day', days: 1 },
  { key: '7d', label: '7 days', days: 7 },
  { key: '30d', label: '30 days', days: 30 },
];

const SOURCES = ['tcgplayer', 'cardmarket'];

export default function CreatePollModal({ open, onClose, onCreated }) {
  const [card, setCard] = useState(null);
  const [direction, setDirection] = useState('bullish');
  const [expiry, setExpiry] = useState('7d');
  const [source, setSource] = useState('tcgplayer');
  const [question, setQuestion] = useState('');
  const [price, setPrice] = useState(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const fetchPrice = async (cardId, src) => {
    setPrice(null);
    try {
      const pricings = await base44.entities.CardPricing.filter({ card_id: cardId, source: src });
      if (pricings.length && pricings[0].avg) setPrice(pricings[0].avg);
    } catch {
      /* unpriced card */
    }
  };

  const selectCard = async (c) => {
    setCard(c);
    await fetchPrice(c.id, source);
    const dirWord = { bullish: 'rise above', bearish: 'fall below', neutral: 'stay around' }[direction];
    const days = EXPIRIES.find((e) => e.key === expiry).days;
    setQuestion(`Will ${c.name} ${dirWord} its current price in the next ${days} day${days > 1 ? 's' : ''}?`);
  };

  const changeSource = async (s) => {
    setSource(s);
    if (card) await fetchPrice(card.id, s);
  };

  const submit = async () => {
    if (!card) return setError('Pick a card first');
    if (!question.trim()) return setError('Write a question');
    setSubmitting(true);
    setError('');
    try {
      const { did, signingKey } = await ensureUserDid();
      const me = await base44.auth.me();
      const days = EXPIRIES.find((e) => e.key === expiry).days;
      const expiresAt = new Date(Date.now() + days * 86400000).toISOString();
      const stamped = await stampRecord(
        {
          card_uri: `at://swappulse/card/${card.id}`,
          card_id: card.id,
          card_name: card.name,
          card_image: card.image || '',
          question: question.trim(),
          direction,
          expires_at: expiresAt,
          resolution_source: source,
          price_at_creation: price || 0,
          vote_counts: { bullish: 0, bearish: 0, neutral: 0 },
          total_votes: 0,
          author_name: me?.full_name || '',
          author_handle: me?.email?.split('@')[0] || '',
        },
        NSID.SENTIMENT_POLL,
        did,
        signingKey,
      );
      const created = await base44.entities.SentimentPoll.create(stamped);
      onCreated?.(created);
      setCard(null);
      setQuestion('');
      setPrice(null);
      onClose();
    } catch (e) {
      setError(e.message || 'Failed to create poll');
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  const pill = (active) =>
    `flex items-center justify-center gap-1 rounded-full border py-2 text-sm font-medium transition ${
      active ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-secondary'
    }`;

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm"
        onClick={onClose}
      >
        <div
          className="mt-8 w-full max-w-lg animate-slide-up rounded-2xl border border-border bg-card shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b border-border p-4">
            <h2 className="text-lg font-bold">New Market Poll</h2>
            <button onClick={onClose} className="rounded-full p-1.5 hover:bg-secondary">
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="space-y-4 p-4">
            <div>
              <Label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Card</Label>
              {card ? (
                <div className="flex items-center gap-3 rounded-xl border border-border bg-secondary p-2">
                  {card.image && <img src={card.image} alt={card.name} className="h-14 w-10 rounded object-cover" />}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{card.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{card.rarity || '—'}</p>
                    {price != null && <p className="text-xs text-success">Current {source} avg: {price}</p>}
                    {price == null && <p className="text-xs text-muted-foreground">Price not tracked — outcome will be inconclusive</p>}
                  </div>
                  <button onClick={() => setCard(null)} className="text-xs text-primary hover:underline">Change</button>
                </div>
              ) : (
                <button onClick={() => setSearchOpen(true)} className={pill(false) + ' w-full'}>
                  Search cards
                </button>
              )}
            </div>

            <div>
              <Label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Your prediction</Label>
              <div className="grid grid-cols-3 gap-2">
                {DIRS.map((d) => (
                  <button key={d.key} onClick={() => setDirection(d.key)} className={pill(direction === d.key)}>
                    <d.icon className="h-4 w-4" /> {d.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Closes in</Label>
                <div className="grid grid-cols-3 gap-1.5">
                  {EXPIRIES.map((e) => (
                    <button key={e.key} onClick={() => setExpiry(e.key)} className={pill(expiry === e.key)}>
                      {e.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Price source</Label>
                <div className="grid grid-cols-2 gap-1.5">
                  {SOURCES.map((s) => (
                    <button key={s} onClick={() => changeSource(s)} className={pill(source === s)}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <Label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Question</Label>
              <textarea
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                maxLength={200}
                rows={2}
                className="w-full resize-none rounded-xl border border-border bg-secondary p-2.5 text-sm outline-none focus:border-primary"
                placeholder="Will this card rise in the next 7 days?"
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button onClick={submit} disabled={submitting} className="gap-1.5">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Create poll
              </Button>
            </div>
          </div>
        </div>
      </div>
      <CardSearchModal open={searchOpen} onClose={() => setSearchOpen(false)} onSelect={selectCard} title="Pick a card to poll" />
    </>
  );
}