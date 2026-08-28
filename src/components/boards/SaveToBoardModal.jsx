import React, { useEffect, useState } from 'react';
import { X, Plus, Loader2, Bookmark } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useToast } from '@/components/ui/use-toast';

export default function SaveToBoardModal({ open, onClose, itemType, itemId, itemUri, thumbnail, title }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [boards, setBoards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [newPublic, setNewPublic] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !user?.id) return;
    (async () => {
      setLoading(true);
      try {
        const res = await base44.entities.BookmarkBoard.filter({}, '-updated_date', 50);
        setBoards(res || []);
      } catch { setBoards([]); } finally { setLoading(false); }
    })();
  }, [open, user?.id]);

  if (!open) return null;

  const addToBoard = async (board) => {
    setSaving(true);
    try {
      const items = [...(board.items || []), {
        item_type: itemType,
        item_id: itemId || '',
        item_uri: itemUri || '',
        thumbnail: thumbnail || '',
        title: title || '',
        added_at: new Date().toISOString(),
      }];
      await base44.entities.BookmarkBoard.update(board.id, { items });
      base44.functions.invoke('bridge-record', { action: 'update', entityName: 'BookmarkBoard', recordId: board.id }).catch(() => {});
      toast({ title: `Saved to ${board.name}` });
      onClose?.();
    } catch (err) {
      toast({ title: 'Could not save', variant: 'destructive' });
    } finally { setSaving(false); }
  };

  const createAndAdd = async () => {
    if (!newName.trim() || !user?.id) return;
    setSaving(true);
    try {
      const created = await base44.entities.BookmarkBoard.create({
        name: newName.trim(),
        visibility: newPublic ? 'public' : 'private',
        items: [{
          item_type: itemType,
          item_id: itemId || '',
          item_uri: itemUri || '',
          thumbnail: thumbnail || '',
          title: title || '',
          added_at: new Date().toISOString(),
        }],
        author_name: user.full_name || '',
        did: user.data?.did || '',
      });
      base44.functions.invoke('bridge-record', { action: 'create', entityName: 'BookmarkBoard', recordId: created.id }).catch(() => {});
      toast({ title: `Created and saved to ${newName.trim()}` });
      onClose?.();
      setNewName('');
    } catch (err) {
      toast({ title: 'Could not create board', variant: 'destructive' });
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4" role="dialog" aria-modal="true">
      <div className="max-h-[80vh] w-full max-w-md overflow-y-auto rounded-t-2xl border border-border bg-card p-5 sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-bold"><Bookmark className="h-5 w-5" /> Save to board</h2>
          <button onClick={onClose} aria-label="Close" className="rounded-full p-1.5 hover:bg-secondary"><X className="h-5 w-5" /></button>
        </div>

        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
        ) : (
          <>
            {boards.length > 0 && (
              <div className="mb-4 space-y-2">
                <p className="text-xs font-bold uppercase text-muted-foreground">Your boards</p>
                {boards.map((b) => (
                  <button
                    key={b.id}
                    onClick={() => addToBoard(b)}
                    disabled={saving}
                    className="flex w-full items-center gap-2 rounded-xl border border-border p-3 text-left text-sm font-semibold hover:bg-secondary disabled:opacity-50"
                  >
                    <Bookmark className="h-4 w-4 text-primary" />
                    <span className="truncate">{b.name}</span>
                    <span className="ml-auto text-xs text-muted-foreground">{(b.items || []).length}</span>
                  </button>
                ))}
              </div>
            )}

            <div className="border-t border-border pt-4">
              <p className="mb-2 text-xs font-bold uppercase text-muted-foreground">New board</p>
              <div className="space-y-2">
                <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Board name (e.g. Grail Gallery)" maxLength={60} />
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={newPublic} onChange={(e) => setNewPublic(e.target.checked)} className="h-4 w-4 rounded" />
                  Make public
                </label>
                <Button onClick={createAndAdd} disabled={saving || !newName.trim()} className="w-full">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Create & Save
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}