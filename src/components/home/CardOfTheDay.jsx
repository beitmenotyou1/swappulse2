import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Sparkles, TrendingUp } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { getCard, cardImageUrl, rarityClasses, cardSetName } from '@/lib/tcgdex';
import CardImage from '@/components/cards/CardImage';
import { useT } from '@/lib/i18n/I18nProvider';

// §4 Card of the Day - surfaces the biggest pricing mover from the feeds service.
export default function CardOfTheDay() {
  const tr = useT();
  const [featured, setFeatured] = useState(null);
  const [card, setCard] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const isAuthed = await base44.auth.isAuthenticated();
        if (!isAuthed) return;
        const res = await base44.functions.invoke('feeds', { feed: 'card-of-day' });
        const f = res.data?.featured;
        if (!active) return;
        setFeatured(f);
        if (f?.cardId) {
          try { setCard(await getCard(f.cardId)); } catch { /* image optional */ }
        }
      } catch { /* no pricing data yet */ }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, []);

  if (loading) {
    return <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;
  }
  if (!featured) return null;

  const { text } = card ? rarityClasses(card.rarity) : {};
  return (
    <Link
      to={`/card/${featured.cardId}`}
      className="mx-4 mb-3 flex items-center gap-3 rounded-2xl border border-border bg-gradient-to-r from-primary/15 to-accent/10 p-3 transition hover:border-primary/40"
    >
      <div className="h-16 w-12 overflow-hidden rounded-lg bg-secondary">
        {card ? (
          <CardImage card={card} alt={featured.cardName} quality="low" />
        ) : (
          <div className="grid h-full w-full place-items-center">
            <Sparkles className="h-5 w-5 text-accent" />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 text-xs font-semibold capitalize text-accent">
          <Sparkles className="h-3.5 w-3.5" /> {tr('home.cardOfTheDay')} · {featured.dayKey}
        </div>
        <p className={`truncate font-bold ${text || ''}`}>{featured.cardName}</p>
        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          <TrendingUp className="h-3 w-3" /> {tr('home.cardOfTheDaySub')}
        </p>
        {card && cardSetName(card) && (
          <p className="truncate text-[10px] text-muted-foreground">{cardSetName(card)}</p>
        )}
      </div>
    </Link>
  );
}