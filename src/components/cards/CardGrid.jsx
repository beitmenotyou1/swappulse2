// CardGrid — paginated card browser with infinite scroll.
//
// Uses the useInfiniteCards hook (get-cards API function) to fetch
// pages as the user scrolls. Renders cards using the existing CardThumb
// component. Includes filter controls for set, rarity, and category.
//
// Designed to be dropped into any page that needs a card browser.

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, AlertCircle, PackageOpen, SlidersHorizontal } from 'lucide-react';
import { useInfiniteCards } from '@/hooks/useCardApi';
import { getCardLanguage, subscribeCardLanguage } from '@/lib/cardLanguage';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const ITEMS_PER_PAGE = 24;

const RARITY_OPTIONS = [
  { value: '', label: 'All Rarities' },
  { value: 'Common', label: 'Common' },
  { value: 'Uncommon', label: 'Uncommon' },
  { value: 'Rare', label: 'Rare' },
  { value: 'Rare Holo', label: 'Rare Holo' },
  { value: 'Illustration Rare', label: 'Illustration Rare' },
  { value: 'Special Illustration Rare', label: 'Special Illustration Rare' },
];

const CATEGORY_OPTIONS = [
  { value: '', label: 'All Categories' },
  { value: 'Pokemon', label: 'Pokemon' },
  { value: 'Trainer', label: 'Trainer' },
  { value: 'Energy', label: 'Energy' },
];

export default function CardGrid({
  setId: initialSetId = '',
  rarity: initialRarity = '',
  category: initialCategory = '',
  onCardClick,
}) {
  const [lang, setLang] = useState(getCardLanguage() || 'en');

  useEffect(() => {
    const unsub = subscribeCardLanguage((newLang) => setLang(newLang || 'en'));
    return unsub;
  }, []);

  const [setId, setSetId] = useState(initialSetId);
  const [rarity, setRarity] = useState(initialRarity);
  const [category, setCategory] = useState(initialCategory);
  const [showFilters, setShowFilters] = useState(false);

  const params = {
    lang,
    itemsPerPage: ITEMS_PER_PAGE,
    ...(setId && { setId }),
    ...(rarity && { rarity }),
    ...(category && { category }),
  };

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    error,
    refetch,
  } = useInfiniteCards(params);

  // Infinite scroll observer
  const sentinelRef = useRef(null);

  const handleObserver = useCallback(
    (entries) => {
      const [entry] = entries;
      if (entry.isIntersecting && hasNextPage && !isFetchingNextPage) {
        fetchNextPage();
      }
    },
    [fetchNextPage, hasNextPage, isFetchingNextPage],
  );

  useEffect(() => {
    const element = sentinelRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(handleObserver, {
      rootMargin: '200px',
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [handleObserver]);

  // Flatten all pages into a single card list
  const allCards = data?.pages.flatMap((page) => page?.data ?? []) ?? [];
  const totalResults = data?.pages[0]?.meta?.total ?? 0;

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-4">
        <FilterBar
          showFilters={showFilters}
          setShowFilters={setShowFilters}
          setId={setId}
          setSetId={setSetId}
          rarity={rarity}
          setRarity={setRarity}
          category={category}
          setCategory={setCategory}
        />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {Array.from({ length: 12 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (isError) {
    return (
      <div className="space-y-4">
        <FilterBar
          showFilters={showFilters}
          setShowFilters={setShowFilters}
          setId={setId}
          setSetId={setSetId}
          rarity={rarity}
          setRarity={setRarity}
          category={category}
          setCategory={setCategory}
        />
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <AlertCircle className="mb-4 h-12 w-12 text-destructive" />
          <h3 className="mb-2 text-lg font-semibold">Failed to load cards</h3>
          <p className="mb-4 text-sm text-muted-foreground">
            {error?.message || 'Something went wrong'}
          </p>
          <Button onClick={() => refetch()} variant="default">
            Try again
          </Button>
        </div>
      </div>
    );
  }

  // Empty state
  if (allCards.length === 0) {
    return (
      <div className="space-y-4">
        <FilterBar
          showFilters={showFilters}
          setShowFilters={setShowFilters}
          setId={setId}
          setSetId={setSetId}
          rarity={rarity}
          setRarity={setRarity}
          category={category}
          setCategory={setCategory}
        />
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <PackageOpen className="mb-4 h-12 w-12 text-muted-foreground" />
          <h3 className="mb-2 text-lg font-semibold">No cards found</h3>
          <p className="text-sm text-muted-foreground">
            Try adjusting your filters.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter bar + count */}
      <FilterBar
        showFilters={showFilters}
        setShowFilters={setShowFilters}
        setId={setId}
        setSetId={setSetId}
        rarity={rarity}
        setRarity={setRarity}
        category={category}
        setCategory={setCategory}
        totalResults={totalResults}
      />

      {/* Card grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {allCards.map((card) => (
          <CardTile
            key={card.id}
            card={card}
            onClick={onCardClick}
          />
        ))}
      </div>

      {/* Infinite scroll sentinel */}
      <div ref={sentinelRef} className="flex justify-center py-6">
        {isFetchingNextPage && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Loading more cards...</span>
          </div>
        )}
        {!hasNextPage && allCards.length > 0 && (
          <p className="text-sm text-muted-foreground">You've reached the end!</p>
        )}
      </div>
    </div>
  );
}

// ============================================================
// Filter Bar
// ============================================================

function FilterBar({
  showFilters,
  setShowFilters,
  setId,
  setSetId,
  rarity,
  setRarity,
  category,
  setCategory,
  totalResults,
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
          >
            <SlidersHorizontal className="h-4 w-4" />
            Filters
          </Button>
          {totalResults !== undefined && (
            <span className="text-sm text-muted-foreground">
              {totalResults.toLocaleString()} cards
            </span>
          )}
        </div>
      </div>

      {showFilters && (
        <div className="grid grid-cols-1 gap-3 rounded-lg border border-border bg-card p-4 sm:grid-cols-3">
          <div>
            <Label className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">
              Set ID
            </Label>
            <Input
              type="text"
              value={setId}
              onChange={(e) => setSetId(e.target.value)}
              placeholder="e.g., swsh3"
              className="text-sm"
            />
          </div>
          <div>
            <Label className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">
              Rarity
            </Label>
            <select
              value={rarity}
              onChange={(e) => setRarity(e.target.value)}
              className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary"
            >
              {RARITY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">
              Category
            </Label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary"
            >
              {CATEGORY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Card Tile (lightweight, uses the existing CardImage component)
// ============================================================

function CardTile({ card, onClick }) {
  const content = (
    <div className="group block overflow-hidden rounded-xl border border-border bg-card transition-all hover:border-primary/50">
      <div className="aspect-[3/4] overflow-hidden bg-muted">
        {card.image ? (
          <img
            src={card.image}
            alt={card.name}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-4xl text-muted-foreground">
            🃏
          </div>
        )}
      </div>
      <div className="p-2">
        <p className="truncate text-xs font-semibold">{card.name}</p>
        <p className="truncate text-[10px] text-muted-foreground">
          {card.rarity || card.setName || `#${card.localId}`}
        </p>
      </div>
    </div>
  );

  if (onClick) {
    return (
      <div onClick={() => onClick(card)} className="cursor-pointer">
        {content}
      </div>
    );
  }

  return <Link to={`/card/${card.id}`}>{content}</Link>;
}

// ============================================================
// Skeleton
// ============================================================

function CardSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="aspect-[3/4] animate-pulse bg-muted" />
      <div className="p-2 space-y-1.5">
        <div className="h-3 w-3/4 animate-pulse rounded bg-muted" />
        <div className="h-2 w-1/2 animate-pulse rounded bg-muted" />
      </div>
    </div>
  );
}