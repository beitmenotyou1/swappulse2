import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2, Bookmark, Trash2, MessageCircle, ArrowLeftRight, CreditCard } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import useSEO from '@/hooks/useSEO';
import { useAuth } from '@/lib/AuthContext';
import { useToast } from '@/components/ui/use-toast';

const TYPE_ICON = {
  post: MessageCircle,
  card: CreditCard,
  trade_listing: ArrowLeftRight,
};

const TYPE_PATH = {
  post: (id) => `/post/${id}`,
  card: (id) => `/card/${id}`,
  trade_listing: (id) => `/trade/${id}`,
};

export default function BoardDetail() {
  const { boardId } = useParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const [board, setBoard] = useState(null);
  const [loading, setLoading] = useState(true);

  useSEO({ title: board?.name || 'Board', description: 'A curated bookmark board of posts, cards, and trade listings on SwapPulse.', canonicalPath: `/boards/${boardId}` });

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const b = await base44.entities.BookmarkBoard.get(boardId);
        setBoard(b);
      } catch { setBoard(null); } finally { setLoading(false); }
    })();
  }, [boardId]);

  const removeItem = async (idx) => {
    if (!board) return;
    const items = (board.items || []).filter((_, i) => i !== idx);
    try {
      await base44.entities.BookmarkBoard.update(board.id, { items });
      setBoard({ ...board, items });
      toast({ title: 'Removed' });
    } catch {
      toast({ title: 'Could not remove', variant: 'destructive' });
    }
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (!board) return <div className="py-20 text-center text-sm text-muted-foreground">Board not found.</div>;

  const isOwner = board.created_by_id === user?.id;
  const items = board.items || [];

  return (
    <div className="mx-auto max-w-2xl px-4 py-4 pb-24 md:pb-8">
      <Link to={isOwner ? '/profile' : `/profile/${board.did}`} className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center gap-2">
          <span className="grid h-10 w-10 place-items-center rounded-full bg-primary/15 text-primary"><Bookmark className="h-5 w-5" /></span>
          <div>
            <h1 className="text-xl font-bold">{board.name}</h1>
            <p className="text-xs text-muted-foreground">{board.visibility === 'public' ? 'Public' : 'Private'} · {items.length} items</p>
          </div>
        </div>
        {board.description && <p className="mt-3 text-sm text-muted-foreground">{board.description}</p>}
      </div>

      <div className="mt-6 space-y-2">
        {items.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">No saved items yet.</p>
        ) : (
          items.map((it, idx) => {
            const Icon = TYPE_ICON[it.item_type] || MessageCircle;
            const path = it.item_id ? TYPE_PATH[it.item_type]?.(it.item_id) : null;
            const content = (
              <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
                {it.thumbnail ? (
                  <img src={it.thumbnail} alt="" className="h-12 w-12 rounded-lg object-cover" />
                ) : (
                  <span className="grid h-12 w-12 place-items-center rounded-lg bg-secondary text-muted-foreground"><Icon className="h-5 w-5" /></span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{it.title || it.item_type}</p>
                  <p className="text-xs capitalize text-muted-foreground">{it.item_type}</p>
                </div>
                {isOwner && (
                  <button onClick={() => removeItem(idx)} aria-label="Remove" className="rounded-full p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            );
            return path ? (
              <Link key={idx} to={path}>{content}</Link>
            ) : (
              <div key={idx}>{content}</div>
            );
          })
        )}
      </div>
    </div>
  );
}