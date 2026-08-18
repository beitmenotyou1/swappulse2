import React, { useState } from 'react';
import { BookOpen, Plus, Trash2, Pencil, Eye } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import JournalEditor from '@/components/profile/JournalEditor';
import JournalView from '@/components/profile/JournalView';
import { formatPrice } from '@/lib/format';

const VIS_BADGE = {
  public: 'bg-success/15 text-success',
  followers: 'bg-accent/15 text-accent',
  private: 'bg-secondary text-muted-foreground',
};

export default function JournalsTab({ journals = [], collection = [], onSaved }) {
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [viewing, setViewing] = useState(null);

  const openNew = () => { setEditing(null); setEditorOpen(true); };
  const openEdit = (j) => { setEditing(j); setEditorOpen(true); };

  const remove = async (j) => {
    if (!confirm('Delete this journal?')) return;
    try {
      if (j.standard_doc_uri) {
        await base44.functions.invoke('publish-standard-document', {
          action: 'delete', documentUri: j.standard_doc_uri,
        }).catch(() => {});
      }
      await base44.entities.Journal.delete(j.id);
      onSaved?.();
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="space-y-3 p-4">
      <div className="flex justify-end">
        <button onClick={openNew} className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-primary/90">
          <Plus className="h-4 w-4" /> New journal
        </button>
      </div>

      {journals.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-12 text-center">
          <BookOpen className="h-10 w-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No journals yet. Write your first collection story.</p>
        </div>
      ) : (
        journals.map((j) => (
          <div key={j.id} className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <button onClick={() => setViewing(j)} className="min-w-0 flex-1 text-left">
                <p className="truncate font-semibold">{j.title}</p>
                {j.subtitle && <p className="truncate text-sm text-muted-foreground">{j.subtitle}</p>}
              </button>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${VIS_BADGE[j.visibility] || ''}`}>
                {j.visibility}
              </span>
            </div>

            {j.tags?.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {j.tags.map((t) => (
                  <span key={t} className="rounded bg-secondary px-2 py-0.5 text-xs text-muted-foreground">#{t}</span>
                ))}
              </div>
            )}

            <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
              <div className="flex items-center gap-3">
                {j.embedded_stats && (
                  <span>
                    {formatPrice(j.embedded_stats.total_collection_value || 0)} · {j.embedded_stats.total_cards || 0} cards
                  </span>
                )}
                <span>{j.like_count || 0} likes</span>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => setViewing(j)} className="rounded p-1.5 hover:bg-secondary"><Eye className="h-4 w-4" /></button>
                <button onClick={() => openEdit(j)} className="rounded p-1.5 hover:bg-secondary"><Pencil className="h-4 w-4" /></button>
                <button onClick={() => remove(j)} className="rounded p-1.5 text-destructive hover:bg-secondary"><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>
          </div>
        ))
      )}

      <JournalEditor open={editorOpen} initial={editing} collection={collection} onClose={() => setEditorOpen(false)} onSaved={() => { setEditorOpen(false); onSaved?.(); }} />
      <JournalView journal={viewing} onClose={() => setViewing(null)} />
    </div>
  );
}