import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Search, Loader2, Users, CreditCard, MessageCircle, ExternalLink, Globe } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import LiveAvatar from '@/components/LiveAvatar';
import ExternalIndicator from '@/components/ExternalIndicator';
import RichText from '@/components/RichText';
import useSEO from '@/hooks/useSEO';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { timeAgo } from '@/lib/format';
import RarityFilterChips from '@/components/cards/RarityFilterChips';
import { rarityKey } from '@/lib/tcgdex';

export default function SearchPage() {
  useSEO({
    title: 'Search',
    description: 'Search collectors, cards, and posts across SwapPulse and the federated AT Protocol network.',
    canonicalPath: '/search',
  });
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [cards, setCards] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [fedActors, setFedActors] = useState([]);
  const [fedPosts, setFedPosts] = useState([]);
  const [searched, setSearched] = useState(false);
  const [rarityFilter, setRarityFilter] = useState('');
  const debounceRef = useRef(null);

  const runSearch = async (q) => {
    if (!q.trim()) {
      setCards([]); setProfiles([]); setFedActors([]); setFedPosts([]); setSearched(false);
      return;
    }
    setLoading(true);
    setSearched(true);
    try {
      const [cardRes, profileRes, fedRes] = await Promise.all([
        base44.functions.invoke('search-cards', { query: q, limit: 12 }).catch(() => ({ data: { results: [] } })),
        base44.functions.invoke('search-profiles', { query: q, limit: 12 }).catch(() => ({ data: { profiles: [] } })),
        user?.id
          ? base44.functions.invoke('federated-search', { query: q, limit: 12 }).catch(() => ({ data: { actors: [], posts: [] } }))
          : Promise.resolve({ data: { actors: [], posts: [] } }),
      ]);
      setCards(cardRes?.data?.results || cardRes?.data?.cards || []);
      setProfiles(profileRes?.data?.profiles || profileRes?.data?.results || []);
      setFedActors(fedRes?.data?.actors || []);
      setFedPosts(fedRes?.data?.posts || []);
    } catch {
      setCards([]); setProfiles([]); setFedActors([]); setFedPosts([]);
    } finally {
      setLoading(false);
    }
  };

  const onType = (val) => {
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(val), 350);
  };

  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);

  const filteredCards = rarityFilter ? cards.filter((c) => rarityKey(c.rarity) === rarityFilter) : cards;
  const hasResults = filteredCards.length > 0 || profiles.length > 0 || fedActors.length > 0 || fedPosts.length > 0;

  return (
    <div>
      <PageHeader title="Search" subtitle="Find collectors, cards, and posts across SwapPulse and the fediverse." />
      <div className="mx-auto max-w-2xl px-4 py-4 pb-24 md:pb-8">
        <div className="flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2.5">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => onType(e.target.value)}
            placeholder="Card name, handle, or collector…"
            className="flex-1 bg-transparent text-sm outline-none"
            autoFocus
          />
          {loading && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
        </div>

        {!searched && (
          <div className="flex flex-col items-center gap-2 py-16 text-center">
            <Search className="h-10 w-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Search across SwapPulse and the federated network.</p>
          </div>
        )}

        {searched && !loading && !hasResults && (
          <p className="py-16 text-center text-sm text-muted-foreground">No results for "{query}".</p>
        )}

        {fedPosts.length > 0 && (
          <section className="mt-5">
            <h2 className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase text-muted-foreground"><Globe className="h-3.5 w-3.5" /> Federated Posts</h2>
            <div className="space-y-2">
              {fedPosts.map((p) => (
                <a
                  key={p.uri}
                  href={`https://bsky.app/profile/${p.authorHandle}/post/${p.uri.split('/').pop()}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block rounded-xl border border-border bg-card p-3 hover:bg-secondary"
                >
                  <div className="flex items-center gap-2">
                    <LiveAvatar did={p.authorDid} name={p.authorName} src={p.authorAvatar} size={28} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold">{p.authorName}</p>
                      <p className="truncate text-xs text-muted-foreground">@{p.authorHandle}</p>
                    </div>
                    <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                  {p.text && <RichText text={p.text} className="mt-1.5 text-sm text-muted-foreground" as="p" />}
                </a>
              ))}
            </div>
          </section>
        )}

        {fedActors.length > 0 && (
          <section className="mt-5">
            <h2 className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase text-muted-foreground"><Globe className="h-3.5 w-3.5" /> Federated Collectors</h2>
            <div className="space-y-2">
              {fedActors.map((a) => (
                <Link key={a.did} to={`/profile/${a.did}`} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 hover:bg-secondary">
                  <LiveAvatar did={a.did} name={a.displayName} src={a.avatar} size={36} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{a.displayName || a.handle}</p>
                    <p className="truncate text-xs text-muted-foreground">@{a.handle}</p>
                  </div>
                  <ExternalIndicator did={a.did} />
                </Link>
              ))}
            </div>
          </section>
        )}

        {profiles.length > 0 && (
          <section className="mt-5">
            <h2 className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase text-muted-foreground"><Users className="h-3.5 w-3.5" /> SwapPulse Collectors</h2>
            <div className="space-y-2">
              {profiles.map((p) => (
                <Link key={p.did || p.id} to={`/profile/${p.did || p.id}`} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 hover:bg-secondary">
                  <LiveAvatar did={p.did} name={p.displayName || p.full_name} src={p.avatar} size={36} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{p.displayName || p.full_name || 'Collector'}</p>
                    <p className="truncate text-xs text-muted-foreground">@{p.handle || p.bsky_handle}</p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {cards.length > 0 && (
          <section className="mt-5">
            <h2 className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase text-muted-foreground"><CreditCard className="h-3.5 w-3.5" /> Cards</h2>
            <RarityFilterChips value={rarityFilter} onChange={setRarityFilter} />
            {filteredCards.length === 0 && rarityFilter && (
              <p className="py-4 text-center text-xs text-muted-foreground">No cards match this rarity. Try a different filter.</p>
            )}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {filteredCards.map((c) => (
                <Link key={c.id || c.cardId} to={`/card/${c.id || c.cardId}`} className="overflow-hidden rounded-xl border border-border bg-card hover:shadow-raised">
                  {c.image || c.card_image ? (
                    <img src={c.image || c.card_image} alt={c.name || c.card_name} className="h-32 w-full object-cover" />
                  ) : (
                    <div className="grid h-32 w-full place-items-center bg-secondary text-muted-foreground"><CreditCard className="h-6 w-6" /></div>
                  )}
                  <p className="truncate p-2 text-xs font-semibold">{c.name || c.card_name}</p>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}