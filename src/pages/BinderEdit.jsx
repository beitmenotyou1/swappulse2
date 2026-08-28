import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Loader2, Plus, Trash2, X, Save } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { ensureUserDid, stampRecord, NSID } from '@/lib/atproto';
import { bridgeBinder } from '@/lib/federatedBridge';
import { updateBridgedRecord } from '@/lib/atprotoRecords';
import { dispatchCrossPost } from '@/lib/crosspost';
import { cardImageUrl } from '@/lib/tcgdex';
import PageHeader from '@/components/PageHeader';
import SlotPicker from '@/components/binder/SlotPicker';
import { BINDER_THEMES } from '@/components/binder/theme';
import { useT } from '@/lib/i18n/I18nProvider';
import useSEO from '@/hooks/useSEO';

const emptySlot = (i) => ({ slot_index: i + 1, collection_entry_uri: '', custom_caption: '' });
const emptyPage = (n) => ({ page_number: n, slots: Array.from({ length: 6 }, (_, i) => emptySlot(i)) });

export default function BinderEdit() {
  const t = useT();
  useSEO({
    title: 'Edit Binder',
    description: 'Create and edit Pokémon TCG collector binders on SwapPulse.',
    canonicalPath: '/binders/new',
  });
  const { binderId } = useParams();
  const navigate = useNavigate();
  const isEdit = !!binderId;
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [theme, setTheme] = useState('classic_purple');
  const [visibility, setVisibility] = useState('private');
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
          setVisibility(b.visibility || 'private');
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
        author_handle: me?.custom_handle || me?.username || me?.bsky_handle || '',
        author_avatar: me?.avatar_url || '',
      };
      const stamped = await stampRecord(record, NSID.BINDER, did, signingKey);
      if (isEdit) {
        // Preserve the existing bridge metadata (at_uri/cid/bridged/did) so the
        // edit doesn't clobber the real federated record link, then push the
        // updated content to the PDS so the federated copy stays in sync.
        const existing = await base44.entities.Binder.get(binderId);
        await base44.entities.Binder.update(binderId, {
          ...stamped,
          at_uri: existing.at_uri,
          cid: existing.cid,
          bridged: existing.bridged,
          did: existing.did,
          record_type: existing.record_type,
          sig: existing.sig,
        });
        if (visibility === 'public') {
          if (existing.bridged && existing.at_uri) {
            updateBridgedRecord({ id: binderId, at_uri: existing.at_uri, bridged: true }, 'Binder').catch(() => {});
          }
        } else {
          // Privacy containment: AT Protocol repositories are public-readable.
          // Followers/private binders must remove every public federation copy.
          if (existing.bridged && existing.at_uri) {
            base44.functions.invoke('atproto-bridge', { action: 'delete', uri: existing.at_uri })
              .then(() => base44.entities.Binder.update(binderId, {
                bridged: false,
                at_uri: '',
                cid: '',
                content_hash: '',
              }))
              .catch((e) => console.error('binder privacy unbridge failed', e));
          }
          if (existing.standard_doc_uri) {
            base44.functions.invoke('publish-standard-document', {
              action: 'delete',
              documentUri: existing.standard_doc_uri,
            }).then((res) => {
              const data = res?.data ?? res;
              if (data?.deleted || data?.ok) {
                base44.entities.Binder.update(binderId, { standard_doc_uri: '' }).catch(() => {});
              }
            }).catch((e) => console.error('binder standard.site privacy delete failed', e));
          }
        }
        navigate(`/binder/${binderId}`);
      } else {
        const created = await base44.entities.Binder.create(stamped);
        bridgeBinder(stamped).then((res) => {
          if (res.bridged) base44.entities.Binder.update(created.id, res).catch(() => {});
        }).catch(() => {});
        dispatchCrossPost('binder', created.id, {
          url: window.location.origin + '/binder/' + created.id,
          authorName: me?.full_name,
          authorHandle: me?.custom_handle || me?.username || me?.bsky_handle || '',
        });
        // Publish as a site.standard.document for interoperable long-form
        // discovery (public binders with a description only).
        if (visibility === 'public' && description.trim()) {
          base44.functions.invoke('publish-standard-document', {
            entityType: 'binder',
            entityId: created.id,
            title: stamped.title,
            path: `/binder/${created.id}`,
            description: stamped.description,
            coverImageUrl: stamped.cover_image_uri,
            tags: [stamped.theme],
            textContent: stamped.description,
            publishedAt: new Date().toISOString(),
            authorName: stamped.author_name,
            authorHandle: stamped.author_handle,
          }).then((res) => {
            const data = res?.data ?? res;
            if (data?.documentUri) {
              base44.entities.Binder.update(created.id, {
                standard_doc_uri: data.documentUri,
                standard_pub_uri: data.authorPubUri,
              }).catch(() => {});
            }
          }).catch((e) => console.error('standard.site binder publish failed', e));
        }
        navigate(`/binder/${created.id}`);
      }
    } catch (e) {
      alert(e.message || t('binder.saveError'));
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
      <PageHeader title={isEdit ? t('binder.editTitle') : t('binder.newTitle')} subtitle={t('binder.editSubtitle')}>
        <button
          onClick={save}
          disabled={saving}
          className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-primary/90 disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} {t('binder.save')}
        </button>
      </PageHeader>

      <div className="space-y-4 p-4">
        <div className="space-y-3 rounded-xl border border-border bg-card p-4">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t('binder.titlePlaceholder')}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-semibold outline-none focus:border-primary"
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t('binder.descPlaceholder')}
            rows={2}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs">
              <span className="text-muted-foreground">{t('binder.theme')}</span>
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
              <span className="text-muted-foreground">{t('binder.visibility')}</span>
              <select
                value={visibility}
                onChange={(e) => setVisibility(e.target.value)}
                className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-2 text-sm"
              >
                <option value="public">{t('binder.visibilityPublic')}</option>
                <option value="followers">{t('binder.visibilityFollowers')}</option>
                <option value="private">{t('binder.visibilityPrivate')}</option>
              </select>
            </label>
          </div>
          <input
            value={cover}
            onChange={(e) => setCover(e.target.value)}
            placeholder={t('binder.coverPlaceholder')}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          />
        </div>

        {pages.map((page, pgIdx) => (
          <div key={pgIdx} className="rounded-xl border border-border bg-card p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-bold">{t('binder.page')} {pgIdx + 1}</h3>
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
                      placeholder={t('binder.captionPlaceholder')}
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
            <Plus className="h-4 w-4" /> {t('binder.addPage')}
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