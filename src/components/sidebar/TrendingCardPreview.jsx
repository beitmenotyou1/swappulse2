import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Globe, Loader2 } from 'lucide-react';
import { getCard, rarityClasses, cardSetName } from '@/lib/tcgdex';
import CardImage from '@/components/cards/CardImage';
import { formatPrice } from '@/lib/format';
import { useT } from '@/lib/i18n/I18nProvider';

// Cache fetched card data so re-hovering the same card is instant.
const cardCache = new Map();

// Hover preview for a trending card name in the sidebar. On mouse enter,
// lazily fetches the card from TCGDex (cached) and shows a small popup with
// the card image and current market price. The popup appears to the LEFT of
// the link so it doesn't overflow the right-hand sidebar.
// On touch devices, the preview triggers on short-hold (long press) or
// double-tap; a single tap navigates normally after a brief delay.
export default function TrendingCardPreview({ card, count }) {
  const tr = useT();
  const navigate = useNavigate();
  const [hovered, setHovered] = useState(false);
  const [cardData, setCardData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);
  const hideTimer = useRef(null);
  const holdTimer = useRef(null);
  const clickTimer = useRef(null);
  const touchTriggeredRef = useRef(false);
  const isTouchRef = useRef(false);
  const containerRef = useRef(null);

  // Lazy fetch on first hover; reuse cached data on subsequent hovers.
  useEffect(() => {
    if (!hovered || fetched || !card.card_id) return;
    let alive = true;
    setLoading(true);
    setFetched(true);
    (async () => {
      if (cardCache.has(card.card_id)) {
        if (alive) { setCardData(cardCache.get(card.card_id)); setLoading(false); }
        return;
      }
      try {
        const data = await getCard(card.card_id);
        cardCache.set(card.card_id, data);
        if (alive) setCardData(data);
      } catch {
        if (alive) setCardData(null);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [hovered, fetched, card.card_id]);

  // Small delay before hiding so the cursor can travel into the popup.
  const handleEnter = () => {
    clearTimeout(hideTimer.current);
    setHovered(true);
  };
  const handleLeave = () => {
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setHovered(false), 200);
  };

  // --- Touch handlers for mobile (short-hold + double-tap) ---
  const handleTouchStart = () => {
    isTouchRef.current = true;
    clearTimeout(hideTimer.current);
    holdTimer.current = setTimeout(() => {
      touchTriggeredRef.current = true;
      setHovered(true);
    }, 400);
  };
  const handleTouchEnd = () => {
    clearTimeout(holdTimer.current);
  };
  const handleTouchMove = () => {
    clearTimeout(holdTimer.current);
  };

  // Close preview when clicking/tapping outside (for touch-triggered preview)
  useEffect(() => {
    if (!hovered) return;
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setHovered(false);
      }
    };
    // Defer listener attachment so the opening click doesn't immediately close
    const timer = setTimeout(() => document.addEventListener('click', handler), 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('click', handler);
    };
  }, [hovered]);

  // Cleanup all timers on unmount
  useEffect(() => () => {
    clearTimeout(hideTimer.current);
    clearTimeout(holdTimer.current);
    if (clickTimer.current) clearTimeout(clickTimer.current);
  }, []);

  const to = card.card_id ? `/card/${card.card_id}` : `/explore?q=${encodeURIComponent(card.card_name)}`;
  const pricing = cardData?.pricing?.tcgplayer || cardData?.pricing?.cardmarket || {};
  const avg = pricing.avg ?? pricing.avg30;

  return (
    <div ref={containerRef} className="relative" onMouseEnter={handleEnter} onMouseLeave={handleLeave}>
      <Link
        to={to}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchMove={handleTouchMove}
        onDoubleClick={(e) => {
          e.preventDefault();
          if (clickTimer.current) { clearTimeout(clickTimer.current); clickTimer.current = null; }
          setHovered(true);
        }}
        onClick={(e) => {
          // If preview was triggered by short-hold, suppress navigation
          if (touchTriggeredRef.current) {
            e.preventDefault();
            touchTriggeredRef.current = false;
            return;
          }
          // If preview is open, close it instead of navigating
          if (hovered) {
            e.preventDefault();
            setHovered(false);
            return;
          }
          if (isTouchRef.current) {
            // Touch device — delay single tap to allow double-tap detection
            e.preventDefault();
            if (clickTimer.current) {
              clearTimeout(clickTimer.current);
              clickTimer.current = null;
              setHovered(true);
            } else {
              clickTimer.current = setTimeout(() => {
                clickTimer.current = null;
                navigate(to);
              }, 300);
            }
          }
          // Desktop — let the Link navigate normally (no delay)
        }}
        className="flex items-center justify-between rounded-lg px-2 py-1 transition-colors hover:bg-secondary"
      >
        <span className="flex items-center gap-1.5 truncate text-sm font-medium">
          {card.source === 'web' && <Globe className="h-3 w-3 shrink-0 text-accent" aria-label={tr('common.fromWeb')} />}
          {card.card_name}
        </span>
        {count > 0 && (
          <span className="ml-2 shrink-0 rounded-full bg-secondary px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground">
            {count}
          </span>
        )}
      </Link>

      {hovered && card.card_id && (
        <div
          className="absolute right-full top-1/2 z-50 mr-2 -translate-y-1/2"
          onMouseEnter={handleEnter}
          onMouseLeave={handleLeave}
        >
          <div className="w-64 rounded-xl border border-border bg-popover p-3 shadow-elevated">
            {loading ? (
              <div className="flex h-40 items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : cardData ? (
              <div className="flex gap-3">
                <div className="h-36 w-26 shrink-0 overflow-hidden rounded-lg border border-border bg-secondary">
                  <CardImage card={cardData} alt={cardData.name} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold leading-tight">{cardData.name}</p>
                  {cardSetName(cardData) && (
                    <p className="truncate text-xs text-muted-foreground">{cardSetName(cardData)}</p>
                  )}
                  {cardData.rarity && (
                    <span className={`mt-1 inline-block text-[11px] font-semibold ${rarityClasses(cardData.rarity).text}`}>
                      {cardData.rarity}
                    </span>
                  )}
                  {avg != null ? (
                    <div className="mt-2">
                      <p className="text-lg font-extrabold leading-none">{formatPrice(Math.round(avg * 100))}</p>
                      <p className="text-[10px] text-muted-foreground">{tr('card.avgMarket')}</p>
                      {pricing.low != null && (
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          {tr('card.low')} {formatPrice(Math.round(pricing.low * 100))}
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="mt-2 text-[11px] text-muted-foreground">{tr('card.noPriceData')}</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex h-40 items-center justify-center text-center text-xs text-muted-foreground">
                {tr('card.dataUnavailable')}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}