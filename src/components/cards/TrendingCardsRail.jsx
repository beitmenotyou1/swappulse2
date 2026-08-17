import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, TrendingUp } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { getCard, cardImageUrl, rarityClasses } from '@/lib/tcgdex';
import { useT } from '@/lib/i18n/I18nProvider';

export default function TrendingCardsRail() {
  const t = useT();
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        // Rank cards by recent social activity (posts that reference a card).
        const recent = await base44.entities.Post.list('-created_date', 60);
        const withCard = (recent || []).filter((p) => p.card_id);
        const counts = {};
        for (const p of withCard) {
          counts[p.card_id] = (counts[p.card_id] || 0) + 1;
        }
        const top = Object.entries(counts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10);
        const details = await Promise.all(
          top.map(([id, count]) =>
            getCard(id).then((c) => (c ? { ...c, _activity: count } : null)).catch(() => null)
          )
        );
        setCards(details.filter(Boolean));
      } catch {
        setCards([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-4 py-4 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm">{t('common.loading')}</span>
      </div>
    );
  }

  if (cards.length === 0) return null;

  return (
    <section className="border-b border-border px-4 py-4">
      <div className="mb-3 flex items-center gap-2">
        <TrendingUp className="h-5 w-5 text-primary" />
        <div>
          <h2 className="text-sm font-extrabold">{t('trending.title')}</h2>
          <p className="text-xs text-muted-foreground">{t('trending.subtitle')}</p>
        </div>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2" style={{ scrollbarWidth: 'thin' }}>
        {cards.map((card) => {
          const { glow } = rarityClasses(card.rarity);
          const img = cardImageUrl(card.image);
          return (
            <Link
              key={card.id}
              to={`/card/${card.id}`}
              className="group relative w-28 shrink-0 overflow-hidden rounded-xl border border-border bg-card transition-all hover:shadow-raised"
            >
              <div className="relative aspect-[3/4]">
                {img ? (
                  <img
                    src={img}
                    alt={card.name}
                    loading="lazy"
                    className={`h-full w-full object-cover ${glow}`}
                  />
                ) : (
                  <div className="flex h-full items-center justify-center bg-secondary text-xs text-muted-foreground">
                    {card.name?.slice(0, 12)}
                  </div>
                )}
                <span className="absolute right-1 top-1 flex items-center gap-0.5 rounded-full bg-background/90 px-1.5 py-0.5 text-[10px] font-bold text-primary shadow">
                  {card._activity} {t('trending.posts')}
                </span>
              </div>
              <div className="p-1.5">
                <p className="truncate text-[11px] font-semibold">{card.name}</p>
                <p className="truncate text-[10px] text-muted-foreground">{card.set?.name}</p>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}