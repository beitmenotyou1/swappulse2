import React, { useEffect, useState, useCallback } from 'react';
import { Plus, Loader2, Bookmark } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import BoardCard from '@/components/boards/BoardCard';
import { useAuth } from '@/lib/AuthContext';

export default function BoardsTab({ did, isOwner }) {
  const { user } = useAuth();
  const [boards, setBoards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await base44.entities.BookmarkBoard.filter({}, '-updated_date', 50);
      setBoards(res || []);
    } catch { setBoards([]); } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const quickCreate = async () => {
    setCreating(true);
    try {
      await base44.entities.BookmarkBoard.create({
        name: 'New Board',
        visibility: 'private',
        items: [],
        author_name: user?.full_name || '',
        did: user?.data?.did || '',
      });
      load();
    } catch { /* ignore */ } finally { setCreating(false); }
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;

  return (
    <div className="py-2">
      {isOwner && (
        <button
          onClick={quickCreate}
          disabled={creating}
          className="mb-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-border p-3 text-sm font-semibold text-muted-foreground hover:border-primary/40 hover:text-primary disabled:opacity-50"
        >
          {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} New board
        </button>
      )}
      {boards.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-12 text-center">
          <Bookmark className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No boards yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {boards.map((b) => <BoardCard key={b.id} board={b} />)}
        </div>
      )}
    </div>
  );
}