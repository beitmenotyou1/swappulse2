import React, { useEffect, useState } from 'react';
import { Loader2, Plus, X, ArrowLeftRight, Star } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import PageHeader from '@/components/PageHeader';
import CardSearchModal from '@/components/cards/CardSearchModal';
import Avatar from '@/components/Avatar';
import { cardImageUrl } from '@/lib/tcgdex';
import { TRADE_STATUS_LABELS } from '@/lib/format';
import { useRealtimeEvent } from '@/hooks/useRealtimeEvent';
import { Link } from 'react-router-dom';

export default function TradeBoard() {
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [myCircleUris, setMyCircleUris] = useState(new Set());

  const load = async () => {
    setLoading(true);
    try {
      setListings(await base44.entities.TradeListing.filter({ status: 'open' }, '-created_date', 50));
    } catch {
      setListings([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // §2.7 circle-scoped trades are only visible to members of the referenced circle.
  useEffect(() => {
    (async () => {
      try {
        const res = await base44.functions.invoke('getMyCircles', {});
        setMyCircleUris(new Set((res.data?.circles || []).map((c) => c.at_uri).filter(Boolean)));
      } catch {
        setMyCircleUris(new Set());
      }
    })();
  }, []);

  // §9.1 live board: append new open listings, update/remove on status change.
  useRealtimeEvent('trade.new_listing', (t) => {
    if (t.status !== 'open') return;
    setListings((prev) => (prev.some((x) => x.id === t.id) ? prev : [t, ...prev]));
  });
  useRealtimeEvent('trade.status_update', (t) => {
    setListings((prev) => {
      if (!prev.some((x) => x.id === t.id)) return prev;
      if (t.status === 'open') return prev.map((x) => (x.id === t.id ? t : x));
      return prev.filter((x) => x.id !== t.id);
    });
  });

  const visibleListings = listings.filter((t) => t.visibility !== 'circle_scoped' || myCircleUris.has(t.circle_ref));

  return (
    <div>
      <PageHeader title="Trade Board" subtitle="Open trade listings">
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-primary/90">
          <Plus className="h-4 w-4" /> New Listing
        </button>
      </PageHeader>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : visibleListings.length === 0 ? (
        <div className="px-4 py-20 text-center">
          <ArrowLeftRight className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
          <p className="text-lg font-bold">No active trades</p>
          <p className="mt-1 text-sm text-muted-foreground">Create a listing to start trading.</p>
        </div>
      ) : (
        <div className="p-4 space-y-3">
          {visibleListings.map((t) => (
            <div key={t.id} className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-center gap-2">
                <Avatar name={t.author_name} src={t.author_avatar} size={32} />
                <span className="text-sm font-semibold">{t.author_name || 'Collector'}</span>
                <span className="text-xs text-muted-foreground">· {TRADE_STATUS_LABELS[t.status] || t.status}</span>
                <span className="ml-auto rounded-full bg-accent/15 px-2 py-0.5 text-xs font-bold text-accent">★ Trusted</span>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-border bg-secondary p-3">
                  <p className="mb-2 text-xs font-bold uppercase text-muted-foreground">Offering</p>
                  <div className="flex flex-wrap gap-2">
                    {t.offer_card_images?.slice(0, 4).map((img, i) => (
                      <img key={i} src={cardImageUrl(img)} alt="" className="h-16 w-12 rounded object-cover" />
                    ))}
                    <div className="flex items-center">
                      <p className="text-sm font-medium">{t.offer_card_names?.join(', ')}</p>
                    </div>
                  </div>
                </div>
                <div className="rounded-xl border border-border bg-secondary p-3">
                  <p className="mb-2 text-xs font-bold uppercase text-muted-foreground">Wants</p>
                  <p className="text-sm font-medium">{t.wanted_card_names?.join(', ')}</p>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <div className="flex gap-1.5">
                  {t.shipping_regions?.map((r) => (
                    <span key={r} className="rounded bg-secondary px-2 py-0.5 text-xs text-muted-foreground">{r}</span>
                  ))}
                  <span className="rounded bg-secondary px-2 py-0.5 text-xs text-muted-foreground">{t.preferred_currency || 'GBP'}</span>
                </div>
                <Link to={`/trade/${t.id}`} className="rounded-full bg-primary px-4 py-1.5 text-xs font-bold text-white hover:bg-primary/90">Negotiate</Link>
              </div>
            </div>
          ))}
        </div>
      )}

      <CreateTradeModal open={showCreate} onClose={() => setShowCreate(false)} onCreated={load} />
    </div>
  );
}

function CreateTradeModal({ open, onClose, onCreated }) {
  const [offers, setOffers] = useState([]);
  const [wants, setWants] = useState([]);
  const [regions, setRegions] = useState(['UK']);
  const [currency, setCurrency] = useState('GBP');
  const [notes, setNotes] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTarget, setSearchTarget] = useState('offers');
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  const handleSave = async () => {
    if (offers.length === 0 || wants.length === 0) {
      alert('Add at least one offered and one wanted card.');
      return;
    }
    setSaving(true);
    try {
      await base44.entities.TradeListing.create({
        offer_card_ids: offers.map((c) => c.id),
        offer_card_names: offers.map((c) => c.name),
        offer_card_images: offers.map((c) => c.image),
        wanted_card_ids: wants.map((c) => c.id),
        wanted_card_names: wants.map((c) => c.name),
        status: 'open',
        visibility: 'public',
        shipping_regions: regions,
        preferred_currency: currency,
        notes,
        author_name: '',
        author_handle: '',
      });
      setOffers([]); setWants([]); setNotes('');
      onClose();
      onCreated();
    } catch (e) {
      alert('Could not create listing: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="mt-6 w-full max-w-lg animate-slide-up rounded-2xl border border-border bg-card p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">New Trade Listing</h2>
          <button onClick={onClose} className="rounded-full p-1.5 hover:bg-secondary"><X className="h-5 w-5" /></button>
        </div>

        <div className="space-y-4">
          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-semibold">Offering</p>
              <button onClick={() => { setSearchTarget('offers'); setSearchOpen(true); }} className="text-xs font-bold text-primary">+ Add card</button>
            </div>
            <div className="flex flex-wrap gap-2 rounded-lg border border-border bg-secondary p-2 min-h-[60px]">
              {offers.map((c) => (
                <div key={c.id} className="relative">
                  <img src={cardImageUrl(c.image)} alt={c.name} className="h-16 w-12 rounded object-cover" />
                  <button onClick={() => setOffers(offers.filter((x) => x.id !== c.id))} className="absolute -right-1 -top-1 rounded-full bg-background p-0.5">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              {offers.length === 0 && <p className="self-center px-2 text-xs text-muted-foreground">No cards added</p>}
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-semibold">Wants</p>
              <button onClick={() => { setSearchTarget('wants'); setSearchOpen(true); }} className="text-xs font-bold text-primary">+ Add card</button>
            </div>
            <div className="flex flex-wrap gap-2 rounded-lg border border-border bg-secondary p-2 min-h-[60px]">
              {wants.map((c) => (
                <div key={c.id} className="relative">
                  <img src={cardImageUrl(c.image)} alt={c.name} className="h-16 w-12 rounded object-cover" />
                  <button onClick={() => setWants(wants.filter((x) => x.id !== c.id))} className="absolute -right-1 -top-1 rounded-full bg-background p-0.5">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              {wants.length === 0 && <p className="self-center px-2 text-xs text-muted-foreground">No cards added</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium">Shipping regions</label>
              <input
                value={regions.join(', ')}
                onChange={(e) => setRegions(e.target.value.split(',').map((s) => s.trim()).filter(Boolean))}
                className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Currency</label>
              <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm outline-none focus:border-primary">
                <option>GBP</option><option>EUR</option><option>USD</option>
              </select>
            </div>
          </div>

          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={500} placeholder="Notes (optional)…" className="w-full resize-none rounded-lg border border-border bg-secondary px-3 py-2 text-sm outline-none focus:border-primary" />
        </div>

        <div className="mt-5 flex gap-2">
          <button onClick={onClose} className="flex-1 rounded-full border border-border py-2.5 text-sm font-semibold hover:bg-secondary">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="flex-1 rounded-full bg-primary py-2.5 text-sm font-bold text-white hover:bg-primary/90 disabled:opacity-50">
            {saving ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : 'Publish Listing'}
          </button>
        </div>
      </div>

      <CardSearchModal
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        title={searchTarget === 'offers' ? 'Select card to offer' : 'Select wanted card'}
        onSelect={(card) => {
          if (searchTarget === 'offers') setOffers((prev) => prev.find((x) => x.id === card.id) ? prev : [...prev, card]);
          else setWants((prev) => prev.find((x) => x.id === card.id) ? prev : [...prev, card]);
        }}
      />
    </div>
  );
}