import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Loader2, ArrowLeft, Heart, ArrowLeftRight, Bell, Plus } from 'lucide-react';
import { getCard, cardImageUrl, rarityClasses } from '@/lib/tcgdex';
import CardImage from '@/components/cards/CardImage';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import AddToCollectionModal from '@/components/cards/AddToCollectionModal';
import CardReviews from '@/components/cards/CardReviews';
import WishlistAlertModal from '@/components/wishlist/WishlistAlertModal';
import DiscussionTab from '@/components/comments/DiscussionTab';
import CardEvolutionChain from '@/components/cards/CardEvolutionChain';
import CardVariantPricing from '@/components/cards/CardVariantPricing';
import CardSetRail from '@/components/cards/CardSetRail';
import PriceHistoryChart from '@/components/cards/PriceHistoryChart';
import { formatPrice } from '@/lib/format';
import useSEO from '@/hooks/useSEO';
import { useI18n } from '@/lib/i18n/I18nProvider';
import CardSocialTabs from '@/components/cards/CardSocialTabs';
import PokeWalletMarket from '@/components/cards/PokeWalletMarket';
import PokemonPriceTrackerMarket from '@/components/cards/PokemonPriceTrackerMarket';
import TcgplayerMarket from '@/components/cards/TcgplayerMarket';
import PokemonProfile from '@/components/cards/PokemonProfile';
export default function CardDetail() {
  const { cardId } = useParams();
  const [card, setCard] = useState(null);
  useSEO({
    title: card ? `${card.name}, ${card.set?.name || 'Pokémon Card'}` : 'Card Details',
    description: card ? `${card.name} from ${card.set?.name || 'Pokémon TCG'}. View stats, reviews, and community discussion on SwapPulse.` : 'Pokémon TCG card details, reviews, and community discussion on SwapPulse.',
    canonicalPath: `/card/${cardId}`,
    ogImage: card ? cardImageUrl(card.image) : '',
    jsonLd: card ? { '@context': 'https://schema.org', '@type': 'Product', name: card.name, description: `Pokémon TCG card from ${card.set?.name || ''}` } : null,
  });
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [showAlert, setShowAlert] = useState(false);
  const [wishlisted, setWishlisted] = useState(false);
  const [wishlistBusy, setWishlistBusy] = useState(false);
  const [tab, setTab] = useState('overview');
  const [myEntry, setMyEntry] = useState(null);
  const { toast } = useToast();
  const { t, locale } = useI18n();

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
  }, [cardId, locale]);

  useEffect(() => {
    (async () => {
      if (!card) return;
      try {
        const existing = await base44.entities.Wishlist.filter({ card_id: card.id }, '-created_date', 1);
        setWishlisted(existing.length > 0);
      } catch {}
    })();
  }, [card]);

  const refreshMyEntry = async () => {
    if (!card) return;
    try {
      const entries = await base44.entities.CollectionEntry.filter({ card_id: card.id }, '-updated_date', 1);
      setMyEntry(entries[0] || null);
    } catch {}
  };

  useEffect(() => {
    if (!card) return;
    refreshMyEntry();
  }, [card]);

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!card) {
    return <div className="py-24 text-center text-muted-foreground">{t('card.notFound')}</div>;
  }

  const { key, text } = rarityClasses(card.rarity);
  const pricing = card.pricing?.tcgplayer || card.pricing?.cardmarket || {};
  const avg = pricing.avg ?? pricing.avg30;

  const toggleWishlist = async () => {
    if (!card) return;
    setWishlistBusy(true);
    try {
      if (wishlisted) {
        await base44.entities.Wishlist.deleteMany({ card_id: card.id });
        setWishlisted(false);
        toast({ title: 'Removed from wishlist' });
      } else {
        await base44.entities.Wishlist.create({
          card_id: card.id,
          card_name: card.name,
          card_image: card.image || '',
          set_id: card.set?.id || '',
          set_name: card.set?.name || '',
          rarity: card.rarity || '',
        });
        setWishlisted(true);
        toast({ title: 'Added to wishlist', description: card.name });
      }
    } catch {
      toast({ title: 'Could not update wishlist', variant: 'destructive' });
    } finally {
      setWishlistBusy(false);
    }
  };

  return (
    <div>
      <div className="flex items-center gap-3 border-b border-border p-3">
        <Link to="/explore" className="rounded-full p-2 hover:bg-secondary">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-bold leading-tight">{card.name}</h1>
          </div>
          <p className="text-xs text-muted-foreground">{card.set?.name} · #{card.localId}</p>
        </div>
      </div>

      <div className="flex gap-1 border-b border-border px-4">
        <button
          onClick={() => setTab('overview')}
          className={`rounded-t-lg px-4 py-2.5 text-sm font-semibold transition-colors ${
            tab === 'overview' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          {t('card.overview')}
        </button>
        <button
          onClick={() => setTab('discussion')}
          className={`rounded-t-lg px-4 py-2.5 text-sm font-semibold transition-colors ${
            tab === 'discussion' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          {t('card.discussion')}
        </button>
      </div>

      <div className={`p-4 ${tab !== 'overview' ? 'hidden' : ''}`}>
        <div className="flex flex-col gap-5 sm:flex-row">
          <div className="mx-auto sm:mx-0">
            <div className="w-56 overflow-hidden rounded-2xl border border-border bg-secondary shadow-xl">
              <CardImage card={card} alt={card.name} className="p-1" />
            </div>
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
                <div><dt className="text-muted-foreground">{t('card.hp')}</dt><dd className="font-semibold">{card.hp}</dd></div>
              )}
              {card.stage && (
                <div><dt className="text-muted-foreground">{t('card.stage')}</dt><dd className="font-semibold">{card.stage}</dd></div>
              )}
              {card.evolveFrom && (
                <div><dt className="text-muted-foreground">{t('card.evolvesFrom')}</dt><dd className="font-semibold">{card.evolveFrom}</dd></div>
              )}
              {card.illustrator && (
                <div><dt className="text-muted-foreground">{t('card.illustrator')}</dt><dd className="font-semibold">{card.illustrator}</dd></div>
              )}
              {card.retreat != null && (
                <div><dt className="text-muted-foreground">{t('card.retreat')}</dt><dd className="font-semibold">{card.retreat}</dd></div>
              )}
            </dl>

            {card.description && (
              <p className="mt-3 text-sm text-muted-foreground italic">{card.description}</p>
            )}

            {card.attacks?.length > 0 && (
              <div className="mt-4 space-y-2">
                <h3 className="text-sm font-bold">{t('card.attacks')}</h3>
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
                <h3 className="text-sm font-bold">{t('card.abilities')}</h3>
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
            <Plus className="h-4 w-4" /> {t('card.addToCollection')}
          </button>
          <button
            onClick={toggleWishlist}
            disabled={wishlistBusy}
            className={`flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold transition-colors disabled:opacity-50 ${
              wishlisted ? 'border border-primary/40 bg-primary/15 text-primary' : 'border border-border hover:bg-secondary'
            }`}
          >
            <Heart className={`h-4 w-4 ${wishlisted ? 'fill-primary' : ''}`} /> {t('card.wishlist')}
          </button>
          <Link
            to="/trades"
            className="flex items-center gap-2 rounded-full border border-border px-4 py-2.5 text-sm font-semibold hover:bg-secondary"
          >
            <ArrowLeftRight className="h-4 w-4" /> {t('card.listForTrade')}
          </Link>
          <button onClick={() => setShowAlert(true)} className="flex items-center gap-2 rounded-full border border-border px-4 py-2.5 text-sm font-semibold hover:bg-secondary">
            <Bell className="h-4 w-4" /> {t('card.priceAlert')}
          </button>
        </div>

        {avg != null && (
          <div className="mt-5 rounded-2xl border border-border bg-card p-4">
            <h3 className="text-sm font-bold">{t('card.marketPrice')}</h3>
            <div className="mt-1 flex items-end gap-3">
              <span className="text-3xl font-extrabold">{formatPrice(Math.round(avg * 100))}</span>
              <span className="mb-1 text-xs text-muted-foreground">{t('card.avgMarket')}</span>
            </div>
            {pricing.trend != null && (
              <p className={`text-sm font-semibold ${pricing.trend >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {pricing.trend >= 0 ? '↑' : '↓'} {Math.abs(pricing.trend).toFixed(2)}
              </p>
            )}
            <p className="mt-1 text-xs text-muted-foreground">{t('card.source')}: TCGPlayer / CardMarket via TCGdex</p>
          </div>
        )}

        <div className="mt-5">
          <PriceHistoryChart card={card} />
        </div>

        <div className="mt-5">
          <CardVariantPricing card={card} />
        </div>

        <div className="mt-5">
          <PokeWalletMarket card={card} />
        </div>

        <div className="mt-5">
          <PokemonPriceTrackerMarket card={card} />
        </div>

        <div className="mt-5">
          <TcgplayerMarket card={card} />
        </div>

        <div className="mt-5 rounded-2xl border border-border bg-card p-4">
          <h3 className="mb-3 text-sm font-bold">{t('card.variants')}</h3>
          <div className="flex flex-wrap gap-2">
            {[
              [t('card.normal'), card.variants?.normal],
              [t('card.holo'), card.variants?.holo],
              [t('card.reverse'), card.variants?.reverse],
              [t('card.firstEdition'), card.variants?.firstEdition],
              [t('card.promo'), card.variants?.wPromo],
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

        {card.weaknesses?.length > 0 || card.resistances?.length > 0 ? (
          <div className="mt-5 rounded-2xl border border-border bg-card p-4">
            <h3 className="mb-3 text-sm font-bold">{t('card.weaknessResistance')}</h3>
            <div className="flex flex-wrap gap-4 text-sm">
              {card.weaknesses?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground">{t('card.weakness')}</p>
                  {card.weaknesses.map((w, i) => (
                    <p key={i} className="font-semibold text-destructive">{w.type} {w.value}</p>
                  ))}
                </div>
              )}
              {card.resistances?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground">{t('card.resistance')}</p>
                  {card.resistances.map((r, i) => (
                    <p key={i} className="font-semibold text-success">{r.type} {r.value}</p>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : null}

        {card.regulationMark && (
          <div className="mt-5 rounded-2xl border border-border bg-card p-4">
            <h3 className="mb-1 text-sm font-bold">{t('card.legality')}</h3>
            <p className="text-sm text-muted-foreground">
              {t('card.regulationMark')} <span className="font-semibold text-foreground">{card.regulationMark}</span>
              {card.legalInStandard && <span className="ml-2 rounded-full bg-success/15 px-2 py-0.5 text-xs font-semibold text-success">{t('card.standardLegal')}</span>}
              {card.legalInExpanded != null && !card.legalInExpanded && <span className="ml-2 rounded-full bg-destructive/15 px-2 py-0.5 text-xs font-semibold text-destructive">{t('card.notExpanded')}</span>}
            </p>
          </div>
        )}
      </div>

      <div className="mt-5 space-y-4 px-4">
        <PokemonProfile card={card} />
        <CardEvolutionChain card={card} />
        <CardSetRail card={card} />
      </div>

      <div className={tab !== 'overview' ? 'hidden' : ''}>
        <CardReviews card={card} />
      </div>

      {tab === 'overview' && <CardSocialTabs card={card} />}

      {tab === 'discussion' && <DiscussionTab card={card} />}

      <AddToCollectionModal open={showAdd} onClose={() => { setShowAdd(false); refreshMyEntry(); }} card={card} />
      {showAlert && <WishlistAlertModal card={card} onClose={() => setShowAlert(false)} />}
    </div>
  );
}