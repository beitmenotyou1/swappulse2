import React, { useState, useEffect } from 'react';
import { X, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { ensureUserDid, stampRecord, NSID } from '@/lib/atproto';
import { bridgeJournal } from '@/lib/federatedBridge';
import { updateBridgedRecord } from '@/lib/atprotoRecords';
import { dispatchCrossPost } from '@/lib/crosspost';
import { formatPrice } from '@/lib/format';

const VIS = [
  ['public', 'Public'],
  ['followers', 'Followers'],
  ['private', 'Private'],
];

export default function JournalEditor({ open, initial, collection = [], onClose, onSaved }) {
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [body, setBody] = useState('');
  const [tags, setTags] = useState('');
  const [visibility, setVisibility] = useState('public');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setTitle(initial?.title || '');
      setSubtitle(initial?.subtitle || '');
      setBody(initial?.body || '');
      setTags((initial?.tags || []).join(', '));
      setVisibility(initial?.visibility || 'public');
      setError('');
    }
  }, [open, initial]);

  if (!open) return null;

  const computeStats = () => {
    const total = collection.reduce((s, c) => s + (c.market_value || c.purchase_price || 0), 0);
    const rarest = collection.slice().sort((a, b) => (b.market_value || 0) - (a.market_value || 0))[0];
    return {
      total_collection_value: total,
      total_cards: collection.length,
      set_completion_percent: 0,
      rarest_card_uri: rarest?.at_uri || rarest?.card_id || '',
    };
  };

  const submit = async () => {
    if (!title.trim() || !body.trim()) return setError('Title and body are required');
    setSaving(true);
    setError('');
    try {
      const { did, signingKey } = await ensureUserDid();
      const me = await base44.auth.me();
      const tagArr = tags.split(',').map((t) => t.trim().replace(/^#/, '')).filter(Boolean).slice(0, 10);
      const stats = computeStats();
      const payload = {
        title: title.trim(),
        subtitle: subtitle.trim(),
        body,
        tags: tagArr,
        visibility,
        embedded_stats: stats,
        author_name: me?.full_name || '',
        author_handle: me?.custom_handle || me?.username || me?.bsky_handle || '',
      };
      if (initial?.id) {
        await base44.entities.Journal.update(initial.id, {
          title: payload.title,
          subtitle: payload.subtitle,
          body: payload.body,
          tags: payload.tags,
          visibility: payload.visibility,
        });
        // Push the edit to the PDS so the federated copy stays in sync.
        if (initial.bridged && initial.at_uri) {
          updateBridgedRecord({ id: initial.id, at_uri: initial.at_uri, bridged: true }, 'Journal').then((res) => {
            if (res?.cid) base44.entities.Journal.update(initial.id, { cid: res.cid, content_hash: res.content_hash || '' }).catch(() => {});
          }).catch(() => {});
        }
      } else {
        const stamped = await stampRecord(
          { ...payload, published_at: new Date().toISOString(), like_count: 0 },
          NSID.JOURNAL,
          did,
          signingKey,
        );
        const created = await base44.entities.Journal.create(stamped);
        bridgeJournal(stamped).then((res) => {
          if (res.bridged) base44.entities.Journal.update(created.id, res).catch(() => {});
        }).catch(() => {});
        dispatchCrossPost('journal', created.id, {
          url: window.location.origin + '/profile',
          authorName: me?.full_name,
          authorHandle: me?.custom_handle || me?.username || me?.bsky_handle || '',
        });
        // Publish as a site.standard.document for interoperable long-form
        // discovery (public journals only).
        if (visibility === 'public') {
          base44.functions.invoke('publish-standard-document', {
            entityType: 'journal',
            entityId: created.id,
            title: stamped.title,
            path: `/journal/${created.id}`,
            description: stamped.subtitle,
            coverImageUrl: stamped.cover_image_uri,
            tags: stamped.tags,
            textContent: stamped.body,
            publishedAt: stamped.published_at,
            authorName: stamped.author_name,
            authorHandle: stamped.author_handle,
          }).then((res) => {
            const data = res?.data ?? res;
            if (data?.documentUri) {
              base44.entities.Journal.update(created.id, {
                standard_doc_uri: data.documentUri,
                standard_pub_uri: data.authorPubUri,
              }).catch(() => {});
            }
          }).catch((e) => console.error('standard.site journal publish failed', e));
        }
      }
      onSaved?.();
    } catch (e) {
      setError(e.message || 'Failed to save journal');
    } finally {
      setSaving(false);
    }
  };

  const pill = (a) =>
    `rounded-full border px-3 py-1.5 text-sm font-medium transition ${a ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-secondary'}`;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="mt-6 w-full max-w-2xl animate-slide-up rounded-2xl border border-border bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border p-4">
          <h2 className="text-lg font-bold">{initial ? 'Edit journal' : 'New journal'}</h2>
          <button aria-label="Close journal editor" onClick={onClose} className="rounded-full p-1.5 hover:bg-secondary"><X className="h-5 w-5" /></button>
        </div>

        <div className="space-y-4 p-4">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={200}
            placeholder="Title"
            className="w-full rounded-xl border border-border bg-secondary px-3 py-2 text-base font-semibold outline-none focus:border-primary"
          />
          <input
            value={subtitle}
            onChange={(e) => setSubtitle(e.target.value)}
            maxLength={300}
            placeholder="Subtitle (optional)"
            className="w-full rounded-xl border border-border bg-secondary px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <div>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={10}
              placeholder="Write your collection story in Markdown…"
              className="w-full resize-y rounded-xl border border-border bg-secondary p-3 font-mono text-sm outline-none focus:border-primary"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Markdown supported. Snapshot frozen at publish: {formatPrice(computeStats().total_collection_value)} · {collection.length} cards.
            </p>
          </div>
          <input
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="Tags (comma separated)"
            className="w-full rounded-xl border border-border bg-secondary px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <div>
            <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Visibility</div>
            <div className="flex gap-2">
              {VIS.map(([k, l]) => (
                <button key={k} onClick={() => setVisibility(k)} className={pill(visibility === k)}>{l}</button>
              ))}
            </div>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 border-t border-border p-4">
          <button onClick={onClose} className="rounded-full border border-border px-4 py-2 text-sm font-semibold hover:bg-secondary">Cancel</button>
          <button onClick={submit} disabled={saving} className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-primary/90 disabled:opacity-50">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {initial ? 'Save' : 'Publish'}
          </button>
        </div>
      </div>
    </div>
  );
}