import React, { useEffect, useState } from 'react';
import { Loader2, Bookmark, Trash2, Pencil, ArrowRight } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import PageHeader from '@/components/PageHeader';
import { cardImageUrl } from '@/lib/tcgdex';
import TradeTemplateEditor from '@/components/trade/TradeTemplateEditor';
import { useToast } from '@/components/ui/use-toast';
import useSEO from '@/hooks/useSEO';
import { useT } from '@/lib/i18n/I18nProvider';

// TradeTemplates — dedicated manager for the current user's saved TradeTemplate
// records. Each card shows the template's offers/wants and supports Use (pre-
// loads the New Listing modal on /trades), Edit (modal form), and Delete.
export default function TradeTemplates() {
  const tr = useT();
  const { toast } = useToast();
  const navigate = useNavigate();
  useSEO({
    title: 'Trade Templates',
    description: 'Manage saved Pokémon TCG trade templates on SwapPulse.',
    canonicalPath: '/trade-templates',
  });
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      setTemplates(await base44.entities.TradeTemplate.list('-created_date', 100));
    } catch {
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const applyTemplate = (tpl) => {
    const draftOffers = (tpl.offer_card_ids || []).map((id, i) => ({
      id,
      name: tpl.offer_card_names?.[i] || id,
      image: tpl.offer_card_images?.[i] || '',
    }));
    navigate('/trades', { state: { draftOffers } });
  };

  const remove = async (tpl) => {
    if (!confirm(tr('trade.deleteTemplateConfirm'))) return;
    try {
      await base44.entities.TradeTemplate.delete(tpl.id);
      setTemplates((prev) => prev.filter((t) => t.id !== tpl.id));
      toast({ title: tr('common.delete'), duration: 2000 });
    } catch (e) {
      alert(tr('trade.couldNotDeleteTemplate') + e.message);
    }
  };

  return (
    <div>
      <PageHeader title={tr('page.tradeTemplates.title')} subtitle={tr('page.tradeTemplates.subtitle')}>
        <Link to="/trades" className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-primary/90">
          {tr('trade.newListingShort')}
        </Link>
      </PageHeader>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : templates.length === 0 ? (
        <div className="px-4 py-20 text-center">
          <Bookmark className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
          <p className="text-lg font-bold">{tr('trade.templateEmpty')}</p>
          <p className="mt-1 text-sm text-muted-foreground">{tr('trade.templateEmptySub')}</p>
          <div className="mt-4">
            <Link to="/trades" className="rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-white">{tr('trade.newListingShort')}</Link>
          </div>
        </div>
      ) : (
        <div className="p-4 space-y-3">
          {templates.map((tpl) => (
            <div key={tpl.id} className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">{tpl.name}</p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    <span className="rounded bg-secondary px-2 py-0.5 text-xs text-muted-foreground">{tpl.preferred_currency || 'GBP'}</span>
                    <span className="rounded bg-secondary px-2 py-0.5 text-xs text-muted-foreground">{tpl.visibility || 'public'}</span>
                    {tpl.shipping_regions?.map((r) => (
                      <span key={r} className="rounded bg-secondary px-2 py-0.5 text-xs text-muted-foreground">{r}</span>
                    ))}
                  </div>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  <button onClick={() => applyTemplate(tpl)} className="flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-xs font-bold text-white hover:bg-primary/90">
                    {tr('trade.useTemplate')} <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => setEditing(tpl)} aria-label={tr('trade.editTemplate')} className="rounded-full border border-border p-1.5 hover:bg-secondary"><Pencil className="h-3.5 w-3.5" /></button>
                  <button onClick={() => remove(tpl)} aria-label={tr('trade.deleteTemplate')} className="rounded-full border border-border p-1.5 text-destructive hover:bg-destructive/10"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-border bg-secondary p-3">
                  <p className="mb-2 text-xs font-bold uppercase text-muted-foreground">{tr('trade.templateOffers')}</p>
                  <div className="flex flex-wrap gap-2">
                    {(tpl.offer_card_images || []).slice(0, 6).map((img, i) => (
                      <img key={i} src={cardImageUrl(img)} alt={tpl.offer_card_names?.[i] || 'card'} loading="lazy" className="h-14 w-10 rounded object-cover" />
                    ))}
                    <span className="self-center text-xs font-medium">{tpl.offer_card_names?.join(', ')}</span>
                  </div>
                </div>
                <div className="rounded-xl border border-border bg-secondary p-3">
                  <p className="mb-2 text-xs font-bold uppercase text-muted-foreground">{tr('trade.templateWants')}</p>
                  <p className="text-sm font-medium">{tpl.wanted_card_names?.join(', ') || '—'}</p>
                </div>
              </div>
              {tpl.notes && <p className="mt-3 text-xs text-muted-foreground">{tpl.notes}</p>}
            </div>
          ))}
        </div>
      )}

      <TradeTemplateEditor
        template={editing}
        open={!!editing}
        onClose={() => setEditing(null)}
        onSaved={load}
      />
    </div>
  );
}