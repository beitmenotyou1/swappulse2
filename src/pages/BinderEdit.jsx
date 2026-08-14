import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Loader2, Plus, Trash2, X, Save } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { ensureUserDid, stampRecord, NSID } from '@/lib/atproto';
import { bridgeBinder } from '@/lib/federatedBridge';
import { dispatchCrossPost } from '@/lib/crosspost';
import { cardImageUrl } from '@/lib/tcgdex';
import PageHeader from '@/components/PageHeader';
import SlotPicker from '@/components/binder/SlotPicker';
import { BINDER_THEMES } from '@/components/binder/theme';

const emptySlot = (i) => ({ slot_index: i + 1, collection_entry_uri: '', custom_caption: '' });
const emptyPage = (n) => ({ page_number: n, slots: Array.from({ length: 6 }, (_, i) => emptySlot(i)) });

export default function BinderEdit() {
  const { binderId } = useParams();
  const navigate = useNavigate();
  const isEdit = !!binderId;
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [theme, setTheme] = useState('classic_purple');
  const [visibility, setVisibility] = useState('public');
  const [cover, setCover] = useState('');
  const [pages, setPages] = useState([emptyPage(1)]);
  const [entries, setEntries] = useState([]);
  const [entryMap, setEntryMap] = useState({});
  const [pickerSlot, setPickerSlot] = useState(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(isEdit);

  useEffect(() => {
    (async () => {
      try {
        const e = await base44.entities.CollectionEntry.list('-updated_date', 500);
        setEntries(e);
        setEntryMap(Object.fromEntries(e.map((x) => [x.id, x])));
        if (isEdit) {
          const b = await base44.entities.Binder.get(binderId);
          setTitle(b.title || '');
          setDescription(b.description || '');
          setTheme(b.theme || 'classic_purple');
          setVisibility(b.visibility || 'public');
          setCover(b.cover_image_uri || '');
          setPages(b.pages?.length ? b.pages : [emptyPage(1)]);
        }
      } catch {
        /* ignore */
      } finally {
        setLoading(false);
      }
    })();
  }, [binderId]);

  const addPage = () => pages.length < 10 && setPages([...pages, emptyPage(pages.length + 1)]);
  const removePage = (idx) =>
    pages.length > 1 &&
    setPages(pages.filter((_, i) => i !== idx).map((p, i) => ({ ...p, page_number: i + 1 })));

  const setSlot = (pgIdx, slIdx, patch) =>
    setPages((prev) =>
      prev.map((p, i) =>
        i !== pgIdx ? p : { ...p, slots: p.slots.map((s, j) => (j !== slIdx ? s : { ...s, ...patch })) },
      ),
    );
  const clearSlot = (pgIdx, slIdx) => setSlot(pgIdx, slIdx, { collection_entry_uri: '', custom_caption: '' });

  const save = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      const { did, signingKey } = await ensureUserDid();
      const me = await base44.auth.me();
      const record = {
        title: title.trim(),
        description: description.trim(),
        cover_image_uri: cover.trim() || undefined,
        theme,
        visibility,
        pages,
        author_name: me?.full_name || '',
        author_handle: me?.email?.split('@')[0] || '',
        author_avatar: me?.avatar_url || '',
      };
      const stamped = await stampRecord(record, NSID.BINDER, did, signingKey);
      if (isEdit) {
        await base44.entities.Binder.update(binderId, stamped);
        navigate(`/binder/${binderId}`);
      } else {
        const created = await base44.entities.Binder.create(stamped);
        bridgeBinder(stamped).then((res) => {
          if (res.bridged) base44.entities.Binder.update(created.id, res).catch(() => {});
        }).catch(() => {});
        dispatchCrossPost('binder', created.id, {
          url: window.location.origin + '/binder/' + created.id,
          authorName: me?.full_name,
          authorHandle: me?.email?.split('@')[0],
        });
        navigate(`/binder/${created.id}`);
      }
    } catch (e) {
      alert(e.message || 'Failed to save binder');
    } finally {
      setSaving(false);
    }
  };

  if (loading)
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );

  return (
    <div>
      <PageHeader title={isEdit ? 'Edit Binder' : 'New Binder'} subtitle="Arrange your prized cards into pages">
        <button
          onClick={save}
          disabled={saving}
          className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-primary/90 disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save
        </button>
      </PageHeader>

      <div className="space-y-4 p-4">
        <div className="space-y-3 rounded-xl border border-border bg-card p-4">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Binder title (e.g. 'My Holos')"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-semibold outline-none focus:border-primary"
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Short description..."
            rows={2}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs">
              <span className="text-muted-foreground">Theme</span>
              <select
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
                className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-2 text-sm"
              >
                {Object.entries(BINDER_THEMES).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs">
              <span className="text-muted-foreground">Visibility</span>
              <select
                value={visibility}
                onChange={(e) => setVisibility(e.target.value)}
                className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-2 text-sm"
              >
                <option value="public">Public</option>
                <option value="followers">Followers</option>
                <option value="private">Private</option>
              </select>
            </label>
          </div>
          <input
            value={cover}
            onChange={(e) => setCover(e.target.value)}
            placeholder="Cover image URL (optional)"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          />
        </div>

        {pages.map((page, pgIdx) => (
          <div key={pgIdx} className="rounded-xl border border-border bg-card p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-bold">Page {pgIdx + 1}</h3>
              <button
                onClick={() => removePage(pgIdx)}
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              {page.slots.map((slot, slIdx) => {
                const entry = slot.collection_entry_uri ? entryMap[slot.collection_entry_uri] : null;
                return (
                  <div key={slIdx} className="flex flex-col gap-1">
                    <div
                      onClick={() => setPickerSlot({ pgIdx, slIdx })}
                      className="relative aspect-[3/4] cursor-pointer overflow-hidden rounded-lg border border-dashed border-border bg-secondary/40 hover:border-primary"
                    >
                      {entry ? (
                        <>
                          {cardImageUrl(entry.card_image) ? (
                            <img
                              src={cardImageUrl(entry.card_image)}
                              alt={entry.card_name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="grid h-full place-items-center p-1 text-center text-[10px] text-muted-foreground">
                              {entry.card_name}
                            </div>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              clearSlot(pgIdx, slIdx);
                            }}
                            className="absolute right-1 top-1 rounded-full bg-background/80 p-0.5 hover:bg-background"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </>
                      ) : (
                        <div className="grid h-full place-items-center">
                          <Plus className="h-5 w-5 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    <input
                      value={slot.custom_caption || ''}
                      onChange={(e) => setSlot(pgIdx, slIdx, { custom_caption: e.target.value })}
                      placeholder="caption"
                      maxLength={100}
                      className="w-full rounded border border-border bg-background px-1 py-0.5 text-[10px] outline-none focus:border-primary"
                    />
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {pages.length < 10 && (
          <button
            onClick={addPage}
            className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-border py-3 text-sm font-semibold text-muted-foreground hover:border-primary hover:text-primary"
          >
            <Plus className="h-4 w-4" /> Add page
          </button>
        )}
      </div>

      {pickerSlot && (
        <SlotPicker
          entries={entries}
          onClose={() => setPickerSlot(null)}
          onSelect={(e) => {
            setSlot(pickerSlot.pgIdx, pickerSlot.slIdx, { collection_entry_uri: e.id, custom_caption: '' });
            setPickerSlot(null);
          }}
        />
      )}
    </div>
  );
}