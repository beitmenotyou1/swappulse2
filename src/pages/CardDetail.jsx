import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Loader2, ArrowLeft, Heart, Bookmark, ArrowLeftRight, Bell, Plus } from 'lucide-react';
import { getCard, cardImageUrl, rarityClasses } from '@/lib/tcgdex';
import AddToCollectionModal from '@/components/cards/AddToCollectionModal';
import CardReviews from '@/components/cards/CardReviews';
import { formatPrice } from '@/lib/format';

export default function CardDetail() {
  const { cardId } = useParams();
  const [card, setCard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        setCard(await getCard(cardId));
      } catch {
        setCard(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [cardId]);

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!card) {
    return <div className="py-24 text-center text-muted-foreground">Card not found.</div>;
  }

  const { key, text } = rarityClasses(card.rarity);
  const pricing = card.pricing?.tcgplayer || card.pricing?.cardmarket || {};
  const avg = pricing.avg ?? pricing.avg30;

  return (
    <div>
      <div className="flex items-center gap-3 border-b border-border p-3">
        <Link to="/explore" className="rounded-full p-2 hover:bg-secondary">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="font-bold leading-tight">{card.name}</h1>
          <p className="text-xs text-muted-foreground">{card.set?.name} · #{card.localId}</p>
        </div>
      </div>

      <div className="p-4">
        <div className="flex flex-col gap-5 sm:flex-row">
          <div className="mx-auto sm:mx-0">
            {cardImageUrl(card.image) ? (
              <img
                src={cardImageUrl(card.image)}
                alt={card.name}
                className="w-56 rounded-2xl border border-border shadow-xl"
              />
            ) : (
              <div className="grid h-80 w-56 place-items-center rounded-2xl border border-border bg-secondary text-sm text-muted-foreground">
                No image
              </div>
            )}
          </div>

          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2">
              {card.rarity && (
                <span className={`rounded-full bg-secondary px-3 py-1 text-xs font-bold ${text}`}>{card.rarity}</span>
              )}
              {card.category && (
                <span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-muted-foreground">{card.category}</span>
              )}
              {card.types?.map((t) => (
                <span key={t} className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-muted-foreground">{t}</span>
              ))}
            </div>

            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              {card.hp && (
                <div><dt className="text-muted-foreground">HP</dt><dd className="font-semibold">{card.hp}</dd></div>
              )}
              {card.stage && (
                <div><dt className="text-muted-foreground">Stage</dt><dd className="font-semibold">{card.stage}</dd></div>
              )}
              {card.evolveFrom && (
                <div><dt className="text-muted-foreground">Evolves from</dt><dd className="font-semibold">{card.evolveFrom}</dd></div>
              )}
              {card.illustrator && (
                <div><dt className="text-muted-foreground">Illustrator</dt><dd className="font-semibold">{card.illustrator}</dd></div>
              )}
              {card.retreat != null && (
                <div><dt className="text-muted-foreground">Retreat</dt><dd className="font-semibold">{card.retreat}</dd></div>
              )}
            </dl>

            {card.description && (
              <p className="mt-3 text-sm text-muted-foreground italic">{card.description}</p>
            )}

            {card.attacks?.length > 0 && (
              <div className="mt-4 space-y-2">
                <h3 className="text-sm font-bold">Attacks</h3>
                {card.attacks.map((a, i) => (
                  <div key={i} className="rounded-lg border border-border bg-secondary p-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">{a.name}</span>
                      {a.damage && <span className="font-bold text-primary">{a.damage}</span>}
                    </div>
                    {a.cost?.length > 0 && (
                      <p className="text-xs text-muted-foreground">{a.cost.join(' · ')}</p>
                    )}
                    {a.effect && <p className="mt-1 text-xs text-muted-foreground">{a.effect}</p>}
                  </div>
                ))}
              </div>
            )}

            {card.abilities?.length > 0 && (
              <div className="mt-4 space-y-2">
                <h3 className="text-sm font-bold">Abilities</h3>
                {card.abilities.map((ab, i) => (
                  <div key={i} className="rounded-lg border border-border bg-secondary p-3 text-sm">
                    <p className="font-semibold text-rarity-holo">{ab.name || ab.type}</p>
                    {ab.effect && <p className="mt-1 text-xs text-muted-foreground">{ab.effect}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-white hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" /> Add to Collection
          </button>
          <button className="flex items-center gap-2 rounded-full border border-border px-4 py-2.5 text-sm font-semibold hover:bg-secondary">
            <Heart className="h-4 w-4" /> Wishlist
          </button>
          <Link
            to="/trades"
            className="flex items-center gap-2 rounded-full border border-border px-4 py-2.5 text-sm font-semibold hover:bg-secondary"
          >
            <ArrowLeftRight className="h-4 w-4" /> List for Trade
          </Link>
          <button className="flex items-center gap-2 rounded-full border border-border px-4 py-2.5 text-sm font-semibold hover:bg-secondary">
            <Bell className="h-4 w-4" /> Price Alert
          </button>
        </div>

        {avg != null && (
          <div className="mt-5 rounded-2xl border border-border bg-card p-4">
            <h3 className="text-sm font-bold">Market Price</h3>
            <div className="mt-1 flex items-end gap-3">
              <span className="text-3xl font-extrabold">{formatPrice(Math.round(avg * 100))}</span>
              <span className="mb-1 text-xs text-muted-foreground">avg market</span>
            </div>
            {pricing.trend != null && (
              <p className={`text-sm font-semibold ${pricing.trend >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                Trend {pricing.trend >= 0 ? '↑' : '↓'} {Math.abs(pricing.trend).toFixed(2)}
              </p>
            )}
            <p className="mt-1 text-xs text-muted-foreground">Source: TCGPlayer / CardMarket via TCGdex</p>
          </div>
        )}

        <div className="mt-5 rounded-2xl border border-border bg-card p-4">
          <h3 className="mb-3 text-sm font-bold">Variants</h3>
          <div className="flex flex-wrap gap-2">
            {[
              ['Normal', card.variants?.normal],
              ['Holo', card.variants?.holo],
              ['Reverse', card.variants?.reverse],
              ['1st Edition', card.variants?.firstEdition],
              ['Promo', card.variants?.wPromo],
            ].map(([label, available]) => (
              <span
                key={label}
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  available ? 'bg-primary/15 text-primary' : 'bg-secondary text-muted-foreground/50'
                }`}
              >
                {label}
              </span>
            ))}
          </div>
        </div>
      </div>

      <CardReviews card={card} />

      <AddToCollectionModal open={showAdd} onClose={() => setShowAdd(false)} card={card} />
    </div>
  );
}