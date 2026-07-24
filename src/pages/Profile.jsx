import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Star, MapPin } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import Avatar from '@/components/Avatar';
import PostCard from '@/components/feed/PostCard';
import { cardImageUrl } from '@/lib/tcgdex';
import { formatPrice } from '@/lib/format';

const TABS = ['Posts', 'Binder', 'Collection', 'Trades'];

export default function Profile() {
  const { user } = useAuth();
  const [tab, setTab] = useState('Posts');
  const [posts, setPosts] = useState([]);
  const [collection, setCollection] = useState([]);
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [p, c, t] = await Promise.all([
          base44.entities.Post.filter({}, '-created_date', 50),
          base44.entities.CollectionEntry.list('-updated_date', 100),
          base44.entities.TradeListing.filter({}, '-created_date', 20),
        ]);
        setPosts(p);
        setCollection(c);
        setTrades(t);
      } catch {} finally {
        setLoading(false);
      }
    })();
  }, []);

  const myPosts = posts.filter((p) => p.author_name === user?.full_name);
  const myCollection = collection;
  const myTrades = trades.filter((t) => t.author_name === user?.full_name || t.author_name === '');
  const portfolioValue = myCollection.reduce((s, c) => s + (c.market_value || c.purchase_price || 0), 0);
  const binderCards = myCollection.slice(0, 9);

  return (
    <div>
      <div className="h-40 w-full bg-gradient-to-r from-primary/40 via-rarity-holo/30 to-accent/30" />
      <div className="px-4">
        <div className="-mt-12 flex items-end justify-between">
          <Avatar name={user?.full_name} size={96} className="ring-4 ring-background" />
        </div>
        <div className="mt-3">
          <h1 className="text-xl font-extrabold">{user?.full_name || 'Collector'}</h1>
          <p className="text-sm text-muted-foreground">@{user?.email?.split('@')[0] || 'collector'}</p>
          <p className="mt-2 text-sm">Pokémon TCG collector and the soul behind SwapPulse.</p>
          <div className="mt-2 flex items-center gap-3 text-sm text-muted-foreground">
            <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> Sutton, Surrey</span>
            <span className="flex items-center gap-1 text-accent"><Star className="h-3.5 w-3.5 fill-current" /> Trusted Trader</span>
          </div>
          <div className="mt-3 flex gap-4 text-sm">
            <span><b>{myPosts.length}</b> <span className="text-muted-foreground">Posts</span></span>
            <span><b>{myCollection.length}</b> <span className="text-muted-foreground">Cards</span></span>
            <span><b>{myTrades.length}</b> <span className="text-muted-foreground">Trades</span></span>
          </div>
        </div>

        <div className="mt-4 flex border-b border-border">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`relative flex-1 py-3 text-sm font-semibold transition-colors ${tab === t ? 'text-foreground' : 'text-muted-foreground hover:bg-secondary'}`}
            >
              {t}
              {tab === t && <span className="absolute bottom-0 left-1/2 h-1 w-10 -translate-x-1/2 rounded-full bg-primary" />}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : tab === 'Posts' ? (
          myPosts.length === 0 ? (
            <p className="py-16 text-center text-sm text-muted-foreground">No posts yet.</p>
          ) : (
            myPosts.map((p) => <PostCard key={p.id} post={p} />)
          )
        ) : tab === 'Binder' ? (
          <div className="p-4">
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-3">
              {binderCards.map((c) => (
                <Link key={c.id} to={`/card/${c.card_id}`}>
                  <img src={cardImageUrl(c.card_image)} alt={c.card_name} className="aspect-[3/4] w-full rounded-lg object-cover" />
                </Link>
              ))}
              {binderCards.length === 0 && <p className="col-span-3 py-10 text-center text-sm text-muted-foreground">Your binder is empty. Add cards to your collection.</p>}
            </div>
          </div>
        ) : tab === 'Collection' ? (
          <div className="p-4">
            <p className="mb-2 text-sm text-muted-foreground">Portfolio value: <b className="text-foreground">{formatPrice(portfolioValue)}</b></p>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {myCollection.map((c) => (
                <Link key={c.id} to={`/card/${c.card_id}`} className="overflow-hidden rounded-lg border border-border bg-card">
                  {cardImageUrl(c.card_image) ? (
                    <img src={cardImageUrl(c.card_image)} alt={c.card_name} className="aspect-[3/4] w-full object-cover" />
                  ) : <div className="aspect-[3/4] bg-secondary" />}
                  <p className="truncate p-1 text-[10px] font-semibold">{c.card_name}</p>
                </Link>
              ))}
            </div>
          </div>
        ) : (
          <div className="p-4 space-y-2">
            {myTrades.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">No trade listings yet.</p>
            ) : myTrades.map((t) => (
              <Link to="/trades" key={t.id} className="block rounded-xl border border-border bg-card p-3">
                <p className="text-sm font-semibold">Offering {t.offer_card_names?.join(', ')}</p>
                <p className="text-xs text-muted-foreground">Wants {t.wanted_card_names?.join(', ')}</p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}