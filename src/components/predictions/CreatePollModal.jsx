import React, { useState } from 'react';
import { X, Loader2, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { ensureUserDid, stampRecord, NSID } from '@/lib/atproto';
import CardSearchModal from '@/components/cards/CardSearchModal';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useT } from '@/lib/i18n/I18nProvider';

const DIRS = [
  { key: 'bullish', labelKey: 'poll.bullish', icon: TrendingUp },
  { key: 'bearish', labelKey: 'poll.bearish', icon: TrendingDown },
  { key: 'neutral', labelKey: 'poll.neutral', icon: Minus },
];

const EXPIRIES = [
  { key: '1d', labelKey: 'poll.1day', days: 1 },
  { key: '7d', labelKey: 'poll.7days', days: 7 },
  { key: '30d', labelKey: 'poll.30days', days: 30 },
];

const SOURCES = ['tcgplayer', 'cardmarket'];

export default function CreatePollModal({ open, onClose, onCreated }) {
  const t = useT();
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
    const dirWord = { bullish: t('poll.dirRise'), bearish: t('poll.dirFall'), neutral: t('poll.dirStay') }[direction];
    const days = EXPIRIES.find((e) => e.key === expiry).days;
    setQuestion(t('poll.questionTemplate').replace('{card}', c.name).replace('{direction}', dirWord).replace('{days}', days));
  };

  const changeSource = async (s) => {
    setSource(s);
    if (card) await fetchPrice(card.id, s);
  };

  const submit = async () => {
    if (!card) return setError(t('poll.pickCard'));
    if (!question.trim()) return setError(t('poll.writeQuestion'));
    setSubmitting(true);
    setError('');
    try {
      const { did, signingKey } = await ensureUserDid();
      const me = await base44.auth.me();
      const days = EXPIRIES.find((e) => e.key === expiry).days;
      const expiresAt = new Date(Date.now() + days * 86400000).toISOString();
      const stamped = await stampRecord(
        {
          card_uri: `at://did:web:swappulse.org/org.swappulse.card/${card.id}`,
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
          author_handle: me?.custom_handle || me?.username || me?.bsky_handle || '',
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
      setError(e.message || t('poll.failed'));
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
            <h2 className="text-lg font-bold">{t('poll.new')}</h2>
            <button aria-label="Close poll form" onClick={onClose} className="rounded-full p-1.5 hover:bg-secondary">
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="space-y-4 p-4">
            <div>
              <Label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('poll.card')}</Label>
              {card ? (
                <div className="flex items-center gap-3 rounded-xl border border-border bg-secondary p-2">
                  {card.image && <img src={card.image} alt={card.name} className="h-14 w-10 rounded object-cover" />}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{card.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{card.rarity || '-'}</p>
                    {price != null && <p className="text-xs text-success">{t('poll.currentAvg').replace('{source}', source).replace('{price}', price)}</p>}
                    {price == null && <p className="text-xs text-muted-foreground">{t('poll.priceNotTracked')}</p>}
                  </div>
                  <button onClick={() => setCard(null)} className="text-xs text-primary hover:underline">{t('poll.change')}</button>
                </div>
              ) : (
                <button onClick={() => setSearchOpen(true)} className={pill(false) + ' w-full'}>
                  {t('poll.searchCards')}
                </button>
              )}
            </div>

            <div>
              <Label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('poll.yourPrediction')}</Label>
              <div className="grid grid-cols-3 gap-2">
                {DIRS.map((d) => (
                  <button key={d.key} onClick={() => setDirection(d.key)} className={pill(direction === d.key)}>
                    <d.icon className="h-4 w-4" /> {t(d.labelKey)}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('poll.closesIn')}</Label>
                <div className="grid grid-cols-3 gap-1.5">
                  {EXPIRIES.map((e) => (
                    <button key={e.key} onClick={() => setExpiry(e.key)} className={pill(expiry === e.key)}>
                      {t(e.labelKey)}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('poll.priceSource')}</Label>
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
              <Label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground" htmlFor="a11y-092ffc0351">{t('poll.question')}</Label>
              <textarea
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                maxLength={200}
                rows={2}
                className="w-full resize-none rounded-xl border border-border bg-secondary p-2.5 text-sm outline-none focus:border-primary"
                placeholder={t('poll.questionPlaceholder')}
               id="a11y-092ffc0351"/>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={onClose}>{t('common.cancel')}</Button>
              <Button onClick={submit} disabled={submitting} className="gap-1.5">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {t('poll.createBtn')}
              </Button>
            </div>
          </div>
        </div>
      </div>
      <CardSearchModal open={searchOpen} onClose={() => setSearchOpen(false)} onSelect={selectCard} title={t('poll.pickCardTitle')} />
    </>
  );
}