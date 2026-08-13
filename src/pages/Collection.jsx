import React, { useEffect, useState } from 'react';
import { Loader2, Plus, Trash2, LayoutGrid, Star, BarChart3, ArrowUpDown, Grid3x3, Layers, Target, Shield } from 'lucide-react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { deleteEntry, updateEntry, bulkUpdateEntries } from '@/lib/offlineSync';
import PageHeader from '@/components/PageHeader';
import { cardImageUrl, rarityClasses } from '@/lib/tcgdex';
import { formatPrice, conditionLabel, variantLabel } from '@/lib/format';
import BinderGrid from '@/components/binder/BinderGrid';
import CollectionAnalytics from '@/components/collection/CollectionAnalytics';
import BulkImportExport from '@/components/collection/BulkImportExport';
import DuplicatesTab from '@/components/collection/DuplicatesTab';
import SetCompletionDashboard from '@/components/collection/SetCompletionDashboard';
import InsuranceExport from '@/components/collection/InsuranceExport';

const TABS = [
  { id: 'cards', label: 'All Cards', icon: LayoutGrid },
  { id: 'completion', label: 'Completion', icon: Target },
  { id: 'duplicates', label: 'Duplicates', icon: Layers },
  { id: 'binder', label: 'Binder', icon: Star },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'import', label: 'Import / Export', icon: ArrowUpDown },
  { id: 'insurance', label: 'Insurance', icon: Shield },
];

export default function Collection() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [tab, setTab] = useState('cards');
  const [me, setMe] = useState(null);
  const [gridSize, setGridSize] = useState('3x3');
  const [binderPublic, setBinderPublic] = useState(false);
  const [savingBinder, setSavingBinder] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      setItems(await base44.entities.CollectionEntry.list('-updated_date', 500));
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  const loadMe = async () => {
    try {
      const user = await base44.auth.me();
      setMe(user);
      setGridSize(user.binder_grid_size || '3x3');
      setBinderPublic(!!user.binder_public);
    } catch {
      /* not logged in is fine for view */
    }
  };

  useEffect(() => {
    load();
    loadMe();
  }, []);

  const remove = async (id) => {
    await deleteEntry(id);
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const toggleShowcase = async (item) => {
    const showcased = !item.showcased;
    const binderCount = items.filter((i) => i.showcased).length;
    if (showcased && binderCount >= (gridSize === '9x9' ? 81 : 9) && !item.showcased) {
      alert(`Your ${gridSize} binder is full. Switch to 9×9 or remove a card.`);
      return;
    }
    await updateEntry(item.id, {
      showcased,
      binder_index: showcased ? binderCount : 0,
    });
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, showcased, binder_index: showcased ? binderCount : 0 } : i)));
  };

  const reorderBinder = async (newOrder) => {
    setItems((prev) => {
      const orderIds = new Set(newOrder.map((i) => i.id));
      const others = prev.filter((i) => !orderIds.has(i.id));
      const reordered = newOrder.map((i, idx) => ({ ...i, binder_index: idx }));
      return [...reordered, ...others];
    });
    try {
      await bulkUpdateEntries(
        newOrder.map((i, idx) => ({ id: i.id, binder_index: idx }))
      );
    } catch (e) {
      /* optimistic update; reload on next visit */
    }
  };

  const setBinderSetting = async (key, value) => {
    const next = { ...me };
    next[key] = value;
    if (key === 'binder_grid_size') setGridSize(value);
    if (key === 'binder_public') setBinderPublic(value);
    setSavingBinder(true);
    try {
      await base44.auth.updateMe({ [key]: value });
    } catch (e) {
      /* ignore persistence error */
    } finally {
      setSavingBinder(false);
    }
  };

  const totalValue = items.reduce((s, c) => s + (c.market_value || c.purchase_price || 0), 0);
  const rarities = [...new Set(items.map((i) => i.rarity).filter(Boolean))];
  const filtered = filter === 'all' ? items : items.filter((i) => i.rarity === filter);
  const showcasedItems = items
    .filter((i) => i.showcased)
    .sort((a, b) => (a.binder_index ?? 0) - (b.binder_index ?? 0));

  return (
    <div>
      <PageHeader title="My Collection" subtitle={`${items.length} cards tracked`}>
        <Link to="/explore" className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-primary/90">
          <Plus className="h-4 w-4" /> Add
        </Link>
      </PageHeader>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto border-b border-border px-4">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-semibold transition ${
                tab === t.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="h-4 w-4" /> {t.label}
            </button>
          );
        })}
      </div>

      {/* Stat strip (always visible) */}
      <div className="grid grid-cols-3 gap-3 p-4">
        <div className="rounded-xl border border-border bg-card p-3">
          <p className="text-xs text-muted-foreground">Total Value</p>
          <p className="text-lg font-extrabold">{formatPrice(totalValue)}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-3">
          <p className="text-xs text-muted-foreground">Cards</p>
          <p className="text-lg font-extrabold">{items.length}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-3">
          <p className="text-xs text-muted-foreground">Showcased</p>
          <p className="text-lg font-extrabold">{showcasedItems.length}</p>
        </div>
      </div>

      {tab === 'cards' && rarities.length > 0 && (
        <div className="flex gap-2 overflow-x-auto px-4 pb-2">
          <button
            onClick={() => setFilter('all')}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${filter === 'all' ? 'bg-primary text-white' : 'bg-secondary text-muted-foreground'}`}
          >
            All
          </button>
          {rarities.map((r) => (
            <button
              key={r}
              onClick={() => setFilter(r)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${filter === r ? 'bg-primary text-white' : 'bg-secondary text-muted-foreground'}`}
            >
              {r}
            </button>
          ))}
        </div>
      )}

      {tab === 'binder' && (
        <div className="p-4">
          <div className="mb-4 flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Grid:</span>
            <div className="flex rounded-full border border-border p-0.5">
              {['3x3', '9x9'].map((g) => (
                <button
                  key={g}
                  onClick={() => setBinderSetting('binder_grid_size', g)}
                  className={`flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${
                    gridSize === g ? 'bg-primary text-white' : 'text-muted-foreground'
                  }`}
                >
                  {g === '3x3' ? <Grid3x3 className="h-3.5 w-3.5" /> : <LayoutGrid className="h-3.5 w-3.5" />}
                  {g}
                </button>
              ))}
            </div>
            {savingBinder && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
          </div>
          <BinderGrid
            items={showcasedItems}
            gridSize={gridSize}
            onReorder={reorderBinder}
            binderPublic={binderPublic}
            onTogglePublic={() => setBinderSetting('binder_public', !binderPublic)}
          />
        </div>
      )}

      {tab === 'duplicates' && (
        loading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : <DuplicatesTab items={items} />
      )}

      {tab === 'completion' && (
        <>
          <div className="flex items-center justify-between px-4 pt-3">
            <p className="text-sm text-muted-foreground">Track your set progress and download printable checklists.</p>
            <Link to="/sets" className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-primary/90">
              <Target className="h-4 w-4" /> Checklist Manager
            </Link>
          </div>
          {loading ? (
            <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : <SetCompletionDashboard items={items} />}
        </>
      )}

      {tab === 'analytics' && (
        loading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : <CollectionAnalytics items={items} />
      )}

      {tab === 'import' && <BulkImportExport items={items} onImported={load} />}

      {tab === 'insurance' && (
        loading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : (
          <div className="p-4"><InsuranceExport items={items} /></div>
        )
      )}

      {tab === 'cards' && (
        loading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : items.length === 0 ? (
          <div className="px-4 py-20 text-center">
            <LayoutGrid className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
            <p className="text-lg font-bold">Your collection is empty</p>
            <p className="mt-1 text-sm text-muted-foreground">Search the catalog and add your first card, or import a CSV.</p>
            <div className="mt-4 flex justify-center gap-2">
              <Link to="/explore" className="rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-white">Explore Cards</Link>
              <button onClick={() => setTab('import')} className="rounded-full border border-border px-5 py-2.5 text-sm font-bold">Import CSV</button>
            </div>
          </div>
        ) : (
          <div className="p-4">
            <div className="space-y-2">
              {filtered.map((item) => {
                const { text } = rarityClasses(item.rarity);
                return (
                  <div key={item.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
                    <button
                      onClick={() => toggleShowcase(item)}
                      className={`shrink-0 ${item.showcased ? 'text-accent' : 'text-muted-foreground hover:text-accent'}`}
                      title={item.showcased ? 'Remove from binder' : 'Pin to binder'}
                    >
                      <Star className={`h-5 w-5 ${item.showcased ? 'fill-accent' : ''}`} />
                    </button>
                    <Link to={`/card/${item.card_id}`}>
                      {cardImageUrl(item.card_image) ? (
                        <img src={cardImageUrl(item.card_image)} alt={item.card_name} className="h-20 w-14 rounded-lg object-cover" />
                      ) : (
                        <div className="h-20 w-14 rounded-lg bg-secondary" />
                      )}
                    </Link>
                    <div className="min-w-0 flex-1">
                      <Link to={`/card/${item.card_id}`} className="block truncate font-semibold hover:text-primary">{item.card_name}</Link>
                      <p className="truncate text-xs text-muted-foreground">{item.set_name} · #{item.local_id}</p>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {item.rarity && <span className={`text-xs font-semibold ${text}`}>{item.rarity}</span>}
                        <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px]">{conditionLabel(item.condition)}</span>
                        <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px]">{variantLabel(item.variant)}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      {item.purchase_price ? (
                        <p className="text-sm font-bold">{formatPrice(item.purchase_price)}</p>
                      ) : (
                        <p className="text-sm text-muted-foreground">-</p>
                      )}
                      <button onClick={() => remove(item.id)} className="mt-1 text-muted-foreground hover:text-red-400">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )
      )}
    </div>
  );
}