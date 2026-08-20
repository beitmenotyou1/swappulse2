import React, { useEffect, useState } from 'react';
import { Loader2, Plus, CheckSquare, LayoutGrid, Star, BarChart3, ArrowUpDown, Grid3x3, Layers, Target, Shield } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { deleteEntry, updateEntry, bulkUpdateEntries } from '@/lib/offlineSync';
import { unbridgeRecord } from '@/lib/atprotoRecords';
import PageHeader from '@/components/PageHeader';
import { formatPrice, conditionLabel } from '@/lib/format';
import BinderGrid from '@/components/binder/BinderGrid';
import CollectionAnalytics from '@/components/collection/CollectionAnalytics';
import BulkImportExport from '@/components/collection/BulkImportExport';
import DuplicatesTab from '@/components/collection/DuplicatesTab';
import SetCompletionDashboard from '@/components/collection/SetCompletionDashboard';
import InsuranceExport from '@/components/collection/InsuranceExport';
import BulkActionsBar from '@/components/collection/BulkActionsBar';
import CollectionCardRow from '@/components/collection/CollectionCardRow';
import { useToast } from "@/components/ui/use-toast";
import GuideFooterLink from '@/components/help/GuideFooterLink';
import { useT } from '@/lib/i18n/I18nProvider';

const TABS = [
  { id: 'cards', tKey: 'page.collection.tabs.cards', icon: LayoutGrid },
  { id: 'completion', tKey: 'page.collection.tabs.completion', icon: Target },
  { id: 'duplicates', tKey: 'page.collection.tabs.duplicates', icon: Layers },
  { id: 'binder', tKey: 'page.collection.tabs.binder', icon: Star },
  { id: 'analytics', tKey: 'page.collection.tabs.analytics', icon: BarChart3 },
  { id: 'import', tKey: 'page.collection.tabs.importExport', icon: ArrowUpDown },
  { id: 'insurance', tKey: 'page.collection.tabs.insurance', icon: Shield },
];

// Rarity rank for sort: higher = rarer. Unknown rarities rank mid (5).
const RARITY_RANK = {
  'Common': 1, 'Uncommon': 2, 'Rare': 3, 'Rare Holo': 4,
  'Ultra Rare': 5, 'Illustration Rare': 6, 'Full Art': 7,
  'Hyper Rare': 8, 'Secret Rare': 9, 'Rainbow Rare': 9, 'Special Illustration Rare': 9,
};
const rarityRank = (r) => (r && RARITY_RANK[r] != null ? RARITY_RANK[r] : 5);

export default function Collection() {
  const tr = useT();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [sort, setSort] = useState('recent');
  const [tab, setTab] = useState('cards');
  const [me, setMe] = useState(null);
  const [gridSize, setGridSize] = useState('3x3');
  const [binderPublic, setBinderPublic] = useState(false);
  const [savingBinder, setSavingBinder] = useState(false);
  const { toast } = useToast();
  const [selected, setSelected] = useState(new Set());
  const [selectMode, setSelectMode] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const navigate = useNavigate();

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
    const item = items.find((i) => i.id === id);
    if (item) await unbridgeRecord(item);
    await deleteEntry(id);
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const toggleShowcase = async (item) => {
    const showcased = !item.showcased;
    const binderCount = items.filter((i) => i.showcased).length;
    if (showcased && binderCount >= (gridSize === '9x9' ? 81 : 9) && !item.showcased) {
      alert(tr('collection.binderFull').replace('{gridSize}', gridSize));
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
  const filteredRaw = filter === 'all' ? items : items.filter((i) => i.rarity === filter);
  const filtered = sort === 'recent'
    ? filteredRaw
    : [...filteredRaw].sort((a, b) =>
        sort === 'rarest'
          ? rarityRank(b.rarity) - rarityRank(a.rarity)
          : rarityRank(a.rarity) - rarityRank(b.rarity)
      );
  const showcasedItems = items
    .filter((i) => i.showcased)
    .sort((a, b) => (a.binder_index ?? 0) - (b.binder_index ?? 0));

  const toggleSelect = (id) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const clearSelection = () => {
    setSelected(new Set());
    setSelectMode(false);
  };

  const allFilteredSelected = filtered.length > 0 && filtered.every((i) => selected.has(i.id));

  const selectAll = () => setSelected(new Set(filtered.map((i) => i.id)));

  const moveToTradeList = () => {
    const picked = items.filter((i) => selected.has(i.id));
    if (!picked.length) return;
    const draftOffers = picked.map((i) => ({ id: i.card_id, name: i.card_name, image: i.card_image }));
    clearSelection();
    navigate('/trades', { state: { draftOffers } });
  };

  const bulkUpdateCondition = async (condition) => {
    const ids = [...selected];
    if (!ids.length) return;
    setBulkBusy(true);
    try {
      await bulkUpdateEntries(ids.map((id) => ({ id, condition })));
      setItems((prev) => prev.map((i) => (selected.has(i.id) ? { ...i, condition } : i)));
      toast({ title: tr('collection.conditionUpdated'), description: tr('collection.cardsMarkedAs').replace('{count}', ids.length).replace('{condition}', conditionLabel(condition)) });
      clearSelection();
    } catch (e) {
      toast({ title: tr('collection.updateFailed'), description: e.message, variant: 'destructive' });
    } finally {
      setBulkBusy(false);
    }
  };

  return (
    <div>
      <PageHeader title={tr('page.collection.title')} subtitle={`${items.length} ${tr('page.collection.cardsTracked')}`}>
        <Link to="/explore" className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-primary/90">
          <Plus className="h-4 w-4" /> {tr('page.collection.add')}
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
              <Icon className="h-4 w-4" /> {tr(t.tKey)}
            </button>
          );
        })}
      </div>

      {/* Stat strip (always visible) */}
      <div className="grid grid-cols-3 gap-3 p-4">
        <div className="rounded-xl border border-border bg-card p-3">
          <p className="text-xs text-muted-foreground">{tr('page.collection.stats.totalValue')}</p>
          <p className="text-lg font-extrabold">{formatPrice(totalValue)}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-3">
          <p className="text-xs text-muted-foreground">{tr('page.collection.stats.cards')}</p>
          <p className="text-lg font-extrabold">{items.length}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-3">
          <p className="text-xs text-muted-foreground">{tr('page.collection.stats.showcased')}</p>
          <p className="text-lg font-extrabold">{showcasedItems.length}</p>
        </div>
      </div>

      {tab === 'cards' && rarities.length > 0 && (
        <div className="flex items-center gap-2 px-4 pb-2">
          <div className="flex flex-1 gap-2 overflow-x-auto">
            <button
              onClick={() => setFilter('all')}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${filter === 'all' ? 'bg-primary text-white' : 'bg-secondary text-muted-foreground'}`}
            >
              {tr('collection.all')}
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
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            aria-label="Sort cards"
            className="shrink-0 rounded-full border border-border bg-secondary px-3 py-1.5 text-xs font-semibold outline-none focus:border-primary"
          >
            <option value="recent">{tr('collection.sortRecent')}</option>
            <option value="rarest">{tr('collection.sortRarest')}</option>
            <option value="common">{tr('collection.sortCommon')}</option>
          </select>
        </div>
      )}

      {tab === 'cards' && items.length > 0 && (
        <div className="flex items-center px-4 pb-2">
          <button
            onClick={() => {
              setSelectMode((s) => !s);
              if (selectMode) setSelected(new Set());
            }}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${selectMode ? 'bg-primary text-white' : 'bg-secondary text-muted-foreground'}`}
          >
            <CheckSquare className="h-3.5 w-3.5" /> {selectMode ? tr('collection.doneSelecting') : tr('collection.selectCards')}
          </button>
        </div>
      )}

      {tab === 'cards' && selected.size > 0 && (
        <BulkActionsBar
          selectedCount={selected.size}
          allSelected={allFilteredSelected}
          onSelectAll={selectAll}
          onClear={clearSelection}
          onMoveToTrade={moveToTradeList}
          onUpdateCondition={bulkUpdateCondition}
          busy={bulkBusy}
        />
      )}

      {tab === 'binder' && (
        <div className="p-4">
          <div className="mb-4 flex items-center gap-2">
            <span className="text-sm text-muted-foreground">{tr('collection.grid')}</span>
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
            <p className="text-sm text-muted-foreground">{tr('collection.completionDesc')}</p>
            <Link to="/sets" className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-primary/90">
              <Target className="h-4 w-4" /> {tr('collection.checklistManager')}
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
            <p className="text-lg font-bold">{tr('collection.empty')}</p>
            <p className="mt-1 text-sm text-muted-foreground">{tr('collection.emptySub')}</p>
            <div className="mt-4 flex justify-center gap-2">
              <Link to="/explore" className="rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-white">{tr('collection.exploreCards')}</Link>
              <button onClick={() => setTab('import')} className="rounded-full border border-border px-5 py-2.5 text-sm font-bold">{tr('collection.importCsv')}</button>
            </div>
          </div>
        ) : (
          <div className="p-4">
            <div className="space-y-2">
              {filtered.map((item) => (
                <CollectionCardRow
                  key={item.id}
                  item={item}
                  selected={selected.has(item.id)}
                  selectMode={selectMode}
                  onToggleSelect={toggleSelect}
                  onToggleShowcase={toggleShowcase}
                  onRemove={remove}
                />
              ))}
            </div>
          </div>
        )
      )}
      <GuideFooterLink slug="collection" />
    </div>
  );
}