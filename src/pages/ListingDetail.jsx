import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Loader2, Store, ShieldCheck, Tag, MapPin } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { ensureUserDid } from '@/lib/atproto';
import PageHeader from '@/components/PageHeader';
import Avatar from '@/components/Avatar';
import { cardImageUrl } from '@/lib/tcgdex';

const CUR_SYM = { GBP: '£', EUR: '€', USD: '$' };
const COND_LABEL = { mint: 'Mint', near_mint: 'Near Mint', excellent: 'Excellent', good: 'Good', damaged: 'Damaged' };

export default function ListingDetail() {
  const { listingId } = useParams();
  const [listing, setListing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [myDid, setMyDid] = useState('');
  const [buying, setBuying] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      setListing(await base44.entities.MarketListing.get(listingId));
    } catch {
      setListing(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      try { const { did } = await ensureUserDid(); setMyDid(did); } catch { /* ignore */ }
    })();
  }, []);

  useEffect(() => { load(); }, [listingId]);

  const buy = async () => {
    setBuying(true);
    setError('');
    try {
      const { did } = await ensureUserDid();
      const me = await base44.auth.me();
      const res = await base44.functions.invoke('create-checkout', { listingId: listing.id, buyerDid: did, buyerName: me?.full_name || '' });
      if (res.data?.redirectUrl) {
        window.location.href = res.data.redirectUrl;
      } else {
        setError(res.data?.error || 'Checkout failed. Please try again.');
      }
    } catch (e) {
      setError(e.message || 'Checkout failed.');
    } finally {
      setBuying(false);
    }
  };

  const cancel = async () => {
    if (!confirm('Cancel this listing?')) return;
    try {
      await base44.entities.MarketListing.update(listing.id, { status: 'cancelled' });
      await load();
    } catch { /* ignore */ }
  };

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (!listing) return <div className="py-16 text-center text-sm text-muted-foreground">Listing not found.</div>;

  const isSeller = myDid && listing.did === myDid;
  const available = listing.status === 'active';

  return (
    <div>
      <PageHeader title={listing.card_name} subtitle="Marketplace listing">
        {isSeller && available && (
          <button onClick={cancel} className="rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-destructive hover:bg-secondary">Cancel listing</button>
        )}
      </PageHeader>

      <div className="mx-auto max-w-2xl space-y-4 px-4 py-4 pb-24 md:pb-8">
        <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-4 sm:flex-row">
          <img src={cardImageUrl(listing.card_image)} alt={listing.card_name} className="mx-auto h-56 w-40 rounded-xl object-cover sm:mx-0" />
          <div className="flex-1 space-y-2">
            <p className="text-xs text-muted-foreground">{listing.set_name || '—'}{listing.rarity ? ` · ${listing.rarity}` : ''}</p>
            <div className="flex flex-wrap gap-2">
              <span className="flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold"><Tag className="h-3 w-3" /> {COND_LABEL[listing.condition] || listing.condition}</span>
              {listing.variant && listing.variant !== 'normal' && (
                <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold">{listing.variant.replace(/_/g, ' ')}</span>
              )}
            </div>
            <p className="text-3xl font-extrabold text-primary">{CUR_SYM[listing.currency || 'GBP']}{Number(listing.price).toFixed(2)}</p>
            <div className="flex items-center gap-2 pt-1">
              <Avatar name={listing.seller_name} src={listing.seller_avatar} size={28} />
              <span className="text-xs text-muted-foreground">Sold by {listing.seller_name || 'Seller'}</span>
            </div>
            {listing.shipping_regions?.length > 0 && (
              <div className="flex flex-wrap items-center gap-1 pt-1">
                <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                {listing.shipping_regions.map((r) => (
                  <span key={r} className="rounded bg-secondary px-1.5 py-0.5 text-[11px] text-muted-foreground">{r}</span>
                ))}
              </div>
            )}
            {listing.notes && <p className="pt-1 text-sm">{listing.notes}</p>}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4">
          {available ? (
            <>
              <button onClick={buy} disabled={buying} className="flex w-full items-center justify-center gap-2 rounded-full bg-primary py-3 text-sm font-bold text-white hover:bg-primary/90 disabled:opacity-50">
                {buying ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                Buy now · {CUR_SYM[listing.currency || 'GBP']}{Number(listing.price).toFixed(2)}
              </button>
              <p className="mt-2 text-center text-xs text-muted-foreground">Secure checkout via Base44 Payments. Card details collected on the payment page.</p>
              {error && <p className="mt-2 text-center text-sm text-destructive">{error}</p>}
            </>
          ) : (
            <div className="flex flex-col items-center gap-1 py-4 text-center">
              <Store className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm font-semibold capitalize">{listing.status === 'sold' ? 'This card has sold.' : listing.status === 'pending' ? 'A purchase is in progress.' : 'Listing cancelled.'}</p>
              <Link to="/marketplace" className="mt-2 text-sm font-semibold text-primary">Back to Marketplace</Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}