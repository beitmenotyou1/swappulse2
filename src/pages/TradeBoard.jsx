import React, { useEffect, useState } from 'react';
import { Loader2, Plus, X, ArrowLeftRight, Bookmark, Trash2, ShieldCheck } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import PageHeader from '@/components/PageHeader';
import CardSearchModal from '@/components/cards/CardSearchModal';
import Avatar from '@/components/Avatar';
import { cardImageUrl } from '@/lib/tcgdex';
import { TRADE_STATUS_LABELS } from '@/lib/format';
import { useRealtimeEvent } from '@/hooks/useRealtimeEvent';
import { Link, useLocation } from 'react-router-dom';
import { bridgeTradeListing, updateBridgedTradeListing } from '@/lib/atprotoRecords';
import { useToast } from "@/components/ui/use-toast";
import useSEO from '@/hooks/useSEO';
import GuideFooterLink from '@/components/help/GuideFooterLink';
import { useT } from '@/lib/i18n/I18nProvider';

export default function TradeBoard() {
  const tr = useT();
  useSEO({
    title: 'Trade Board',
    description: 'Browse and post open Pokémon TCG trade listings on the SwapPulse trade board, peer-to-peer card exchange.',
    canonicalPath: '/trades',
  });
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [initialOffers, setInitialOffers] = useState([]);
  const [myCircleUris, setMyCircleUris] = useState(new Set());
  const [currentUser, setCurrentUser] = useState(null);
  const [trustedDids, setTrustedDids] = useState(new Set());
  const [trustedOnly, setTrustedOnly] = useState(false);
  const [enforcedIds, setEnforcedIds] = useState(new Set());
  const { toast } = useToast();
  const location = useLocation();

  const load = async () => {
    setLoading(true);
    try {
      const [trades, enforced] = await Promise.all([
        base44.entities.TradeListing.filter({ status: 'open' }, '-created_date', 50).catch(() => []),
        base44.functions.invoke('get-enforced-dids', {}).catch(() => ({ data: { user_ids: [] } })),
      ]);
      setListings(trades);
      setEnforcedIds(new Set(enforced.data?.user_ids || []));
    } catch {
      setListings([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // Fetch the set of DIDs holding a granted Trusted Trader achievement
  useEffect(() => {
    (async () => {
      try {
        const badges = await base44.entities.Achievement.filter({
          achievement_type: 'trusted_trader',
          status: 'granted',
        }, '-unlocked_at', 200);
        setTrustedDids(new Set(badges.map((b) => b.did).filter(Boolean)));
      } catch {
        setTrustedDids(new Set());
      }
    })();
  }, []);

  const handleMarkCompleted = async (listing) => {
    try {
      await base44.entities.TradeListing.update(listing.id, { status: 'completed' });
      let pdsSynced = false;
      if (listing.bridged && listing.at_uri) {
        const syncResult = await updateBridgedTradeListing({ ...listing, status: 'completed' });
        pdsSynced = !!syncResult?.bridged;
        if (syncResult?.cid) {
          await base44.entities.TradeListing.update(listing.id, { cid: syncResult.cid });
        }
      }
      toast({
        title: pdsSynced ? '✅ Marked completed & synced to AT Protocol' : 'Marked as completed',
        description: pdsSynced ? 'The network sees the updated status.' : undefined,
        duration: 4000,
      });
      load();
    } catch (e) {
      toast({ title: 'Could not update status', description: e.message, variant: 'destructive' });
    }
  };

  useEffect(() => {
    const draft = location.state?.draftOffers;
    if (draft?.length) {
      setInitialOffers(draft);
      setShowCreate(true);
      window.history.replaceState({}, document.title);
    }
  }, []);

  // §2.7 circle-scoped trades are only visible to members of the referenced circle.
  useEffect(() => {
    (async () => {
      try { setCurrentUser(await base44.auth.me()); } catch { setCurrentUser(null); }
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

  const now = Date.now();
  const visibleListings = listings.filter((t) => {
    if (enforcedIds.has(t.created_by_id) && (!currentUser || t.created_by_id !== currentUser.id)) return false;
    if (t.expires_at && new Date(t.expires_at).getTime() < now) return false;
    if (t.visibility !== 'circle_scoped' || myCircleUris.has(t.circle_ref)) {
      if (trustedOnly && !trustedDids.has(t.did)) return false;
      return true;
    }
    return false;
  });

  return (
    <div>
      <PageHeader title={tr('page.trades.title')} subtitle={tr('page.trades.subtitle')}>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-primary/90">
          <Plus className="h-4 w-4" /> {tr('page.trades.newListing')}
        </button>
      </PageHeader>

      {!loading && listings.length > 0 && (
        <div className="flex items-center gap-2 px-4 py-2">
          <button
            onClick={() => setTrustedOnly((v) => !v)}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
              trustedOnly ? 'bg-success text-white' : 'bg-secondary text-muted-foreground'
            }`}
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            Trusted traders only
          </button>
          {trustedOnly && (
            <span className="text-xs text-muted-foreground">
              {visibleListings.length} of {listings.filter((t) => !t.expires_at || new Date(t.expires_at).getTime() >= now).length} listings
            </span>
          )}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : visibleListings.length === 0 ? (
        <div className="px-4 py-20 text-center">
          <ArrowLeftRight className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
          <p className="text-lg font-bold">{tr('page.trades.empty')}</p>
          <p className="mt-1 text-sm text-muted-foreground">{tr('page.trades.emptySub')}</p>
        </div>
      ) : (
        <div className="p-4 space-y-3">
          {visibleListings.map((t) => (
            <div key={t.id} className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-center gap-2">
                <Avatar name={t.author_name} src={t.author_avatar} size={32} />
                <span className="text-sm font-semibold">{t.author_name || 'Collector'}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                  t.status === 'open' ? 'bg-success/15 text-success' :
                  t.status === 'completed' ? 'bg-secondary text-muted-foreground' :
                  'bg-warning/15 text-warning'
                }`}>{TRADE_STATUS_LABELS[t.status] || t.status}</span>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-border bg-secondary p-3">
                  <p className="mb-2 text-xs font-bold uppercase text-muted-foreground">Offering</p>
                  <div className="flex flex-wrap gap-2">
                    {t.offer_card_images?.slice(0, 4).map((img, i) => (
                      <img key={i} src={cardImageUrl(img)} alt={t.offer_card_names?.[i] || 'card'} loading="lazy" className="h-16 w-12 rounded object-cover" />
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
                <div className="flex gap-2">
                  {currentUser && t.created_by_id === currentUser.id && (
                    <button
                      onClick={() => handleMarkCompleted(t)}
                      className="rounded-full border border-border px-3 py-1.5 text-xs font-bold hover:bg-secondary"
                    >
                      Mark Completed
                    </button>
                  )}
                  <Link to={`/trade/${t.id}`} className="rounded-full bg-primary px-4 py-1.5 text-xs font-bold text-white hover:bg-primary/90">Negotiate</Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <CreateTradeModal
        open={showCreate}
        onClose={() => { setShowCreate(false); setInitialOffers([]); }}
        onCreated={load}
        initialOffers={initialOffers}
      />
      <GuideFooterLink slug="trade-board" />
    </div>
  );
}

function CreateTradeModal({ open, onClose, onCreated, initialOffers = [] }) {
  const [offers, setOffers] = useState([]);
  const [wants, setWants] = useState([]);
  const [regions, setRegions] = useState(['UK']);
  const [currency, setCurrency] = useState('GBP');
  const [notes, setNotes] = useState('');
  const [expiresIn, setExpiresIn] = useState('30');
  const [visibility, setVisibility] = useState('public');
  const [circles, setCircles] = useState([]);
  const [circleRef, setCircleRef] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTarget, setSearchTarget] = useState('offers');
  const [saving, setSaving] = useState(false);
  const [bridgeStatus, setBridgeStatus] = useState('idle');
  const [templates, setTemplates] = useState([]);
  const [templateName, setTemplateName] = useState('');
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [loadedTemplateId, setLoadedTemplateId] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        const res = await base44.functions.invoke('getMyCircles', {});
        setCircles((res.data?.circles || []).filter((c) => c.at_uri));
      } catch {
        setCircles([]);
      }
      try {
        setTemplates(await base44.entities.TradeTemplate.list('-created_date', 50));
      } catch {
        setTemplates([]);
      }
    })();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setOffers(initialOffers?.length ? initialOffers : []);
    setWants([]);
  }, [open, initialOffers]);

  const loadTemplate = (tpl) => {
    if (!tpl) return;
    setLoadedTemplateId(tpl.id);
    setOffers((tpl.offer_card_ids || []).map((id, i) => ({ id, name: tpl.offer_card_names?.[i] || id, image: tpl.offer_card_images?.[i] || '' })));
    setWants((tpl.wanted_card_ids || []).map((id, i) => ({ id, name: tpl.wanted_card_names?.[i] || id })));
    setRegions(tpl.shipping_regions?.length ? tpl.shipping_regions : ['UK']);
    setCurrency(tpl.preferred_currency || 'GBP');
    setVisibility(tpl.visibility || 'public');
    setNotes(tpl.notes || '');
  };

  const saveTemplate = async () => {
    if (!templateName.trim()) { alert('Enter a template name.'); return; }
    if (offers.length === 0 && wants.length === 0) { alert('Add at least one card before saving.'); return; }
    try {
      await base44.entities.TradeTemplate.create({
        name: templateName.trim(),
        offer_card_ids: offers.map((c) => c.id),
        offer_card_names: offers.map((c) => c.name),
        offer_card_images: offers.map((c) => c.image),
        wanted_card_ids: wants.map((c) => c.id),
        wanted_card_names: wants.map((c) => c.name),
        shipping_regions: regions,
        preferred_currency: currency,
        visibility,
        notes,
      });
      setTemplateName('');
      setShowSaveTemplate(false);
      setTemplates(await base44.entities.TradeTemplate.list('-created_date', 50));
      toast({ title: 'Template saved', duration: 3000 });
    } catch (e) {
      alert('Could not save template: ' + e.message);
    }
  };

  const deleteTemplate = async (id) => {
    try {
      await base44.entities.TradeTemplate.delete(id);
      setTemplates(templates.filter((t) => t.id !== id));
      if (loadedTemplateId === id) setLoadedTemplateId('');
    } catch (e) {
      alert('Could not delete template: ' + e.message);
    }
  };

  if (!open) return null;

  const handleSave = async () => {
    if (offers.length === 0 || wants.length === 0) {
      alert('Add at least one offered and one wanted card.');
      return;
    }
    if (offers.length > 20 || wants.length > 20) {
      alert('Maximum 20 cards per side.');
      return;
    }
    if (visibility === 'circle_scoped' && !circleRef) {
      alert('Select a circle for this circle-scoped listing.');
      return;
    }
    const days = parseInt(expiresIn, 10);
    const expires_at = days > 0 ? new Date(Date.now() + days * 86400000).toISOString() : undefined;
    setSaving(true);
    try {
      const created = await base44.entities.TradeListing.create({
        offer_card_ids: offers.map((c) => c.id),
        offer_card_names: offers.map((c) => c.name),
        offer_card_images: offers.map((c) => c.image),
        wanted_card_ids: wants.map((c) => c.id),
        wanted_card_names: wants.map((c) => c.name),
        status: 'open',
        visibility,
        circle_ref: visibility === 'circle_scoped' ? circleRef : undefined,
        shipping_regions: regions,
        preferred_currency: currency,
        notes,
        expires_at,
        author_name: '',
        author_handle: '',
      });
      // Mirror to AT Protocol PDS and persist the real at_uri/cid back to the entity
      let bridgedUri = null;
      let bridgeOk = false;
      if (created?.id) {
        setBridgeStatus('syncing');
        try {
          const bridged = await bridgeTradeListing(created);
          await base44.entities.TradeListing.update(created.id, bridged);
          bridgedUri = bridged.at_uri || null;
          bridgeOk = !!bridged.bridged;
          setBridgeStatus(bridgeOk ? 'synced' : 'failed');
        } catch (e) {
          console.error('atprotoRecords: bridge trade listing failed', e);
          setBridgeStatus('failed');
        }
      }
      if (bridgeOk && bridgedUri) {
        toast({
          title: '✅ Listing published & synced to AT Protocol',
          description: `PDS record: ${bridgedUri}`,
          duration: 6000,
        });
      } else {
        toast({
          title: '⚠️ Listing published locally',
          description: 'PDS sync failed, your listing is live but not yet federated.',
          variant: 'destructive',
          duration: 6000,
        });
      }
      setOffers([]); setWants([]); setNotes(''); setCircleRef('');
      setBridgeStatus('idle');
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
          <button onClick={onClose} aria-label="Close" className="rounded-full p-1.5 hover:bg-secondary"><X className="h-5 w-5" /></button>
        </div>

        {templates.length > 0 && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-border bg-secondary p-2">
            <Bookmark className="h-4 w-4 shrink-0 text-muted-foreground" />
            <select
              onChange={(e) => { const tpl = templates.find((t) => t.id === e.target.value); if (tpl) loadTemplate(tpl); e.target.value = ''; }}
              className="flex-1 rounded border border-border bg-background px-2 py-1.5 text-sm outline-none focus:border-primary"
              defaultValue=""
            >
              <option value="">Load a template…</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            {loadedTemplateId && (
              <button onClick={() => deleteTemplate(loadedTemplateId)} aria-label="Delete loaded template" className="shrink-0 rounded p-1.5 text-destructive hover:bg-destructive/10">
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-semibold">Offering</p>
              <button onClick={() => { setSearchTarget('offers'); setSearchOpen(true); }} disabled={offers.length >= 20} className="text-xs font-bold text-primary disabled:opacity-50">+ Add card</button>
              <span className="text-xs text-muted-foreground">{offers.length}/20</span>
            </div>
            <div className="flex flex-wrap gap-2 rounded-lg border border-border bg-secondary p-2 min-h-[60px]">
              {offers.map((c) => (
                <div key={c.id} className="relative">
                  <img src={cardImageUrl(c.image)} alt={c.name} className="h-16 w-12 rounded object-cover" />
                  <button onClick={() => setOffers(offers.filter((x) => x.id !== c.id))} aria-label={`Remove ${c.name}`} className="absolute -right-1 -top-1 rounded-full bg-background p-0.5">
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
              <button onClick={() => { setSearchTarget('wants'); setSearchOpen(true); }} disabled={wants.length >= 20} className="text-xs font-bold text-primary disabled:opacity-50">+ Add card</button>
              <span className="text-xs text-muted-foreground">{wants.length}/20</span>
            </div>
            <div className="flex flex-wrap gap-2 rounded-lg border border-border bg-secondary p-2 min-h-[60px]">
              {wants.map((c) => (
                <div key={c.id} className="relative">
                  <img src={cardImageUrl(c.image)} alt={c.name} className="h-16 w-12 rounded object-cover" />
                  <button onClick={() => setWants(wants.filter((x) => x.id !== c.id))} aria-label={`Remove ${c.name}`} className="absolute -right-1 -top-1 rounded-full bg-background p-0.5">
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

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium">Listing expires</label>
              <select value={expiresIn} onChange={(e) => setExpiresIn(e.target.value)} className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm outline-none focus:border-primary">
                <option value="7">In 7 days</option>
                <option value="30">In 30 days</option>
                <option value="90">In 90 days</option>
                <option value="0">No expiry</option>
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Visibility</label>
              <select value={visibility} onChange={(e) => setVisibility(e.target.value)} className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm outline-none focus:border-primary">
                <option value="public">Public</option>
                <option value="wishlist_only">Wishlist matches only</option>
                <option value="circle_scoped">Circle only</option>
              </select>
            </div>
          </div>
          {visibility === 'circle_scoped' && (
            <div>
              <label className="mb-1.5 block text-sm font-medium">Visible to circle</label>
              {circles.length === 0 ? (
                <p className="text-xs text-muted-foreground">You have no circles to scope this listing to. Create a circle first.</p>
              ) : (
                <select value={circleRef} onChange={(e) => setCircleRef(e.target.value)} className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm outline-none focus:border-primary">
                  <option value="">Select a circle…</option>
                  {circles.map((c) => (
                    <option key={c.at_uri} value={c.at_uri}>{c.name || 'Circle'}</option>
                  ))}
                </select>
              )}
            </div>
          )}

          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={500} placeholder="Notes (optional)…" className="w-full resize-none rounded-lg border border-border bg-secondary px-3 py-2 text-sm outline-none focus:border-primary" />
        </div>

        {showSaveTemplate ? (
          <div className="mt-4 flex items-center gap-2">
            <input
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="Template name…"
              maxLength={100}
              className="flex-1 rounded-lg border border-border bg-secondary px-3 py-2 text-sm outline-none focus:border-primary"
            />
            <button onClick={saveTemplate} className="rounded-full bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-primary/90">Save</button>
            <button onClick={() => { setShowSaveTemplate(false); setTemplateName(''); }} className="rounded-full border border-border px-4 py-2 text-sm font-semibold hover:bg-secondary">Cancel</button>
          </div>
        ) : (
          <button onClick={() => setShowSaveTemplate(true)} className="mt-4 flex items-center gap-1.5 text-xs font-bold text-primary hover:underline">
            <Bookmark className="h-3.5 w-3.5" /> Save current details as template
          </button>
        )}

        <div className="mt-5 flex gap-2">
          <button onClick={onClose} className="flex-1 rounded-full border border-border py-2.5 text-sm font-semibold hover:bg-secondary">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="flex-1 rounded-full bg-primary py-2.5 text-sm font-bold text-white hover:bg-primary/90 disabled:opacity-50">
            {saving ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                {bridgeStatus === 'syncing' ? 'Syncing to PDS…' : 'Publishing…'}
              </span>
            ) : 'Publish Listing'}
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