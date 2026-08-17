import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, MessageSquareOff, ArrowLeftRight, Package } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import PostCard from '@/components/feed/PostCard';
import { useT } from '@/lib/i18n/I18nProvider';

const TABS = ['posts', 'trades', 'packOpenings'];

export default function CardSocialTabs({ card }) {
  const t = useT();
  const [tab, setTab] = useState('posts');
  const [posts, setPosts] = useState([]);
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      if (!card?.id) return;
      setLoading(true);
      try {
        const [postRes, tradeRes] = await Promise.all([
          base44.entities.Post.filter({ card_id: card.id }, '-created_date', 20).catch(() => []),
          base44.entities.TradeListing.filter({ card_id: card.id }, '-created_date', 10).catch(() => []),
        ]);
        setPosts(postRes || []);
        setTrades(tradeRes || []);
      } catch {
        setPosts([]);
        setTrades([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [card?.id]);

  const packOpenings = posts.filter((p) => p.post_type === 'pack_opening');
  const socialPosts = posts.filter((p) => p.post_type !== 'pack_opening');

  const tabContent = {
    posts: socialPosts,
    trades,
    packOpenings,
  };

  const tabLabel = {
    posts: t('card.posts'),
    trades: t('card.trades'),
    packOpenings: t('card.packOpenings'),
  };

  return (
    <div className="mt-5">
      <div className="flex gap-1 border-b border-border">
        {TABS.map((tk) => (
          <button
            key={tk}
            onClick={() => setTab(tk)}
            className={`rounded-t-lg px-4 py-2.5 text-sm font-semibold transition-colors ${
              tab === tk ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tabLabel[tk]}
            <span className="ml-1.5 text-xs text-muted-foreground">{tabContent[tk].length}</span>
          </button>
        ))}
      </div>

      <div className="py-4">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : tab === 'trades' ? (
          tabContent.trades.length === 0 ? (
            <EmptyState icon={ArrowLeftRight} text={t('common.noResults')} />
          ) : (
            <div className="space-y-2">
              {tabContent.trades.map((tl) => (
                <Link
                  key={tl.id}
                  to={`/trade/${tl.id}`}
                  className="flex items-center justify-between rounded-xl border border-border bg-card p-3 transition-colors hover:bg-secondary/50"
                >
                  <div>
                    <p className="text-sm font-semibold">{tl.have_card_name || tl.want_card_name || 'Trade'}</p>
                    <p className="text-xs text-muted-foreground">
                      {tl.have_card_name ? `Have: ${tl.have_card_name}` : ''} {tl.want_card_name ? `· Want: ${tl.want_card_name}` : ''}
                    </p>
                  </div>
                  <ArrowLeftRight className="h-4 w-4 text-muted-foreground" />
                </Link>
              ))}
            </div>
          )
        ) : tabContent[tab].length === 0 ? (
          <EmptyState icon={tab === 'packOpenings' ? Package : MessageSquareOff} text={t('common.noResults')} />
        ) : (
          <div className="space-y-4">
            {tabContent[tab].map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyState({ icon: Icon, text }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <Icon className="h-8 w-8 text-muted-foreground/40" />
      <p className="mt-2 text-sm text-muted-foreground">{text}</p>
    </div>
  );
}