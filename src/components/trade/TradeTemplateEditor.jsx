import React, { useEffect, useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import CardSearchModal from '@/components/cards/CardSearchModal';
import { cardImageUrl } from '@/lib/tcgdex';
import { useToast } from '@/components/ui/use-toast';
import { useT } from '@/lib/i18n/I18nProvider';
import SettingSelect from '@/components/settings/SettingSelect';

// TradeTemplateEditor — modal form for editing a saved TradeTemplate's name,
// offers, wants, shipping regions, currency, visibility, and notes. Mirrors the
// compose modal's offer/want card UI. Saves via TradeTemplate.update.
export default function TradeTemplateEditor({ template, open, onClose, onSaved }) {
  const tr = useT();
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [offers, setOffers] = useState([]);
  const [wants, setWants] = useState([]);
  const [regions, setRegions] = useState(['UK']);
  const [currency, setCurrency] = useState('GBP');
  const [visibility, setVisibility] = useState('public');
  const [notes, setNotes] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTarget, setSearchTarget] = useState('offers');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !template) return;
    setName(template.name || '');
    setOffers((template.offer_card_ids || []).map((id, i) => ({ id, name: template.offer_card_names?.[i] || id, image: template.offer_card_images?.[i] || '' })));
    setWants((template.wanted_card_ids || []).map((id, i) => ({ id, name: template.wanted_card_names?.[i] || id })));
    setRegions(template.shipping_regions?.length ? template.shipping_regions : ['UK']);
    setCurrency(template.preferred_currency || 'GBP');
    setVisibility(template.visibility || 'public');
    setNotes(template.notes || '');
  }, [open, template]);

  if (!open || !template) return null;

  const save = async () => {
    if (!name.trim()) { alert(tr('trade.enterTemplateName')); return; }
    setSaving(true);
    try {
      await base44.entities.TradeTemplate.update(template.id, {
        name: name.trim(),
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
      toast({ title: tr('trade.templateSaved'), duration: 3000 });
      onSaved?.();
      onClose();
    } catch (e) {
      alert(tr('trade.couldNotSaveTemplate') + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="mt-6 w-full max-w-lg animate-slide-up rounded-2xl border border-border bg-card p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">{tr('trade.editTemplateTitle')}</h2>
          <button onClick={onClose} aria-label="Close" className="rounded-full p-1.5 hover:bg-secondary"><X className="h-5 w-5" /></button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium" htmlFor="a11y-4225d06a53">{tr('trade.templateNamePlaceholder')}</label>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={100} className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm outline-none focus:border-primary"  id="a11y-4225d06a53"/>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-semibold">{tr('trade.offering')}</p>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{offers.length}/20</span>
                <button onClick={() => { setSearchTarget('offers'); setSearchOpen(true); }} disabled={offers.length >= 20} className="text-xs font-bold text-primary disabled:opacity-50">{tr('trade.addCard')}</button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 rounded-lg border border-border bg-secondary p-2 min-h-[60px]">
              {offers.map((c) => (
                <div key={c.id} className="relative">
                  <img src={cardImageUrl(c.image)} alt={c.name} className="h-16 w-12 rounded object-cover" />
                  <button onClick={() => setOffers(offers.filter((x) => x.id !== c.id))} aria-label={`Remove ${c.name}`} className="absolute -right-1 -top-1 rounded-full bg-background p-0.5"><X className="h-3 w-3" /></button>
                </div>
              ))}
              {offers.length === 0 && <p className="self-center px-2 text-xs text-muted-foreground">{tr('trade.noCardsAdded')}</p>}
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-semibold">{tr('trade.wants')}</p>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{wants.length}/20</span>
                <button onClick={() => { setSearchTarget('wants'); setSearchOpen(true); }} disabled={wants.length >= 20} className="text-xs font-bold text-primary disabled:opacity-50">{tr('trade.addCard')}</button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 rounded-lg border border-border bg-secondary p-2 min-h-[60px]">
              {wants.map((c) => (
                <div key={c.id} className="relative">
                  <img src={cardImageUrl(c.image)} alt={c.name} className="h-16 w-12 rounded object-cover" />
                  <button onClick={() => setWants(wants.filter((x) => x.id !== c.id))} aria-label={`Remove ${c.name}`} className="absolute -right-1 -top-1 rounded-full bg-background p-0.5"><X className="h-3 w-3" /></button>
                </div>
              ))}
              {wants.length === 0 && <p className="self-center px-2 text-xs text-muted-foreground">{tr('trade.noCardsAdded')}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium" htmlFor="a11y-b020addf42">{tr('trade.shippingRegions')}</label>
              <input
                value={regions.join(', ')}
                onChange={(e) => setRegions(e.target.value.split(',').map((s) => s.trim()).filter(Boolean))}
                className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm outline-none focus:border-primary"
               id="a11y-b020addf42"/>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">{tr('trade.currency')}</label>
              <SettingSelect value={currency} onChange={setCurrency} label={tr('trade.currency')} options={[{value:'GBP',label:'GBP'},{value:'EUR',label:'EUR'},{value:'USD',label:'USD'}]} />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium">{tr('trade.visibility')}</label>
            <SettingSelect value={visibility} onChange={setVisibility} label={tr('trade.visibility')} options={[{value:'public',label:tr('trade.public')},{value:'wishlist_only',label:tr('trade.wishlistOnly')},{value:'circle_scoped',label:tr('trade.circleOnly')}]} />
          </div>

          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={500} placeholder={tr('trade.notesPlaceholder')} className="w-full resize-none rounded-lg border border-border bg-secondary px-3 py-2 text-sm outline-none focus:border-primary"  aria-label={tr('trade.notesPlaceholder')}/>
        </div>

        <div className="mt-5 flex gap-2">
          <button onClick={onClose} className="flex-1 rounded-full border border-border py-2.5 text-sm font-semibold hover:bg-secondary">{tr('common.cancel')}</button>
          <button onClick={save} disabled={saving} className="flex-1 rounded-full bg-primary py-2.5 text-sm font-bold text-white hover:bg-primary/90 disabled:opacity-50">
            {saving ? (
              <span className="flex items-center justify-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> {tr('trade.save')}</span>
            ) : tr('trade.save')}
          </button>
        </div>
      </div>

      <CardSearchModal
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        title={searchTarget === 'offers' ? tr('trade.selectCardToOffer') : tr('trade.selectWantedCard')}
        onSelect={(card) => {
          if (searchTarget === 'offers') setOffers((prev) => prev.find((x) => x.id === card.id) ? prev : [...prev, card]);
          else setWants((prev) => prev.find((x) => x.id === card.id) ? prev : [...prev, card]);
        }}
      />
    </div>
  );
}