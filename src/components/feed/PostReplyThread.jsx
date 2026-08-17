import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Loader2, Send, CornerDownRight } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import LiveAvatar from '@/components/LiveAvatar';
import { timeAgo } from '@/lib/format';
import { createReply } from '@/lib/postInteractions';
import CommentActions from '@/components/comments/CommentActions';
import RichText from '@/components/RichText';
import { getPostDetailPath, isInteractiveTarget } from '@/lib/postNav';

const MAX_LEN = 300;

function ReplyNode({ reply, children, onPosted }) {
  const hasChildren = React.Children.count(children) > 0;
  const navigate = useNavigate();
  const detailPath = getPostDetailPath(reply);
  const handleReplyClick = (e) => {
    if (isInteractiveTarget(e) || !detailPath) return;
    navigate(detailPath);
  };
  return (
    <div className="flex gap-2.5">
      {/* Avatar column with a vertical connector line dropping to children */}
      <div className="flex flex-col items-center shrink-0">
        <LiveAvatar did={reply.did} name={reply.author_name} src={reply.author_avatar} size={32} />
        {hasChildren && <div className="w-0.5 flex-1 bg-border mt-1.5 mb-1" />}
      </div>
      {/* Content column */}
      <div
        onClick={handleReplyClick}
        className={`min-w-0 flex-1 pb-1 ${detailPath ? 'cursor-pointer' : ''}`}
      >
        <div className="flex items-baseline gap-1.5">
          <span className="text-sm font-semibold leading-snug">{reply.author_name || 'Collector'}</span>
          <span className="text-[11px] text-muted-foreground">{timeAgo(reply.created_date)}</span>
        </div>
        <p className="mt-0.5 text-sm leading-snug">
          <RichText as="span" text={reply.content} />
        </p>
        <CommentActions comment={reply} onPosted={onPosted} compact />
        {hasChildren && <div className="mt-1.5">{children}</div>}
      </div>
    </div>
  );
}

// Inline reply thread shown beneath a PostCard. In preview mode (default) it
// shows the first few direct replies + a "View full thread" link; in full mode
// (PostDetail) it renders the entire recursive reply tree. The composer
// creates a federated reply via createReply.
export default function PostReplyThread({ parentPost, showFullThreadLink = true, full = false }) {
  const { user } = useAuth();
  const [all, setAll] = useState([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [posting, setPosting] = useState(false);
  const [replyError, setReplyError] = useState('');

  const load = useCallback(async () => {
    if (!parentPost?.id) { setLoading(false); return; }
    try {
      // Fetch all descendants: posts whose root_uri points at this post, plus
      // direct replies (reply_to) for threads where root_uri is not set.
      const [byRoot, byReply, byParent] = await Promise.all([
        base44.entities.Post.filter({ root_uri: parentPost.at_uri || '' }, '-created_date', 200).catch(() => []),
        base44.entities.Post.filter({ reply_to: parentPost.id }, '-created_date', 200).catch(() => []),
        base44.entities.Post.filter({ parent_uri: parentPost.at_uri || '' }, '-created_date', 200).catch(() => []),
      ]);
      const merge = new Map();
      [...byRoot, ...byReply, ...byParent].forEach((p) => merge.set(p.id, p));
      const list = Array.from(merge.values()).sort((a, b) => new Date(a.created_date) - new Date(b.created_date));
      setAll(list);
    } catch {
      setAll([]);
    } finally {
      setLoading(false);
    }
  }, [parentPost?.id, parentPost?.at_uri]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const unsub = base44.entities.Post.subscribe(() => { load(); });
    return unsub;
  }, [load]);

  const childrenOf = (id, uriOverride) => {
    const parent = all.find((p) => p.id === id);
    const parentUri = uriOverride || parent?.at_uri || '';
    const seen = new Set();
    const result = [];
    for (const r of all) {
      if (seen.has(r.id)) continue;
      // Match by local parent id OR federated parent URI — dedup by id so a
      // reply that satisfies both conditions doesn't render twice.
      if (r.reply_to === id || (parentUri && r.parent_uri === parentUri)) {
        seen.add(r.id);
        result.push(r);
      }
    }
    return result;
  };
  const directReplies = childrenOf(parentPost.id, parentPost.at_uri);

  const submit = async () => {
    const trimmed = text.trim();
    if (!trimmed || posting || !user?.id) return;
    setPosting(true);
    setReplyError('');
    try {
      await createReply(parentPost, trimmed, user);
      setText('');
      load();
    } catch (e) {
      setReplyError(e?.message || 'Could not post reply');
    } finally {
      setPosting(false);
    }
  };

  const renderTree = (parentId, depth = 0, parentUri) => {
    const kids = childrenOf(parentId, parentUri);
    if (kids.length === 0) return null;
    return (
      <div className={depth > 0 ? '' : 'mt-3 space-y-3'}>
        {kids.map((r) => (
          <ReplyNode key={r.id} reply={r} onPosted={load}>
            {depth < 6 && renderTree(r.id, depth + 1, r.at_uri)}
          </ReplyNode>
        ))}
      </div>
    );
  };

  return (
    <div className="mt-3">
      {loading ? (
        <div className="flex justify-center py-3"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
      ) : full ? (
        <>
          {renderTree(parentPost.id, 0, parentPost.at_uri)}
          {all.length === 0 && <p className="text-xs text-muted-foreground">No replies yet.</p>}
        </>
      ) : (
        <div className="space-y-2">
          {directReplies.slice(0, 3).map((r) => (
            <ReplyNode key={r.id} reply={r} onPosted={load} />
          ))}
          {all.length > 3 && showFullThreadLink && (
            <Link to={`/post/${parentPost.id}`} className="text-xs font-semibold text-primary hover:underline">
              View full thread ({all.length})
            </Link>
          )}
          {directReplies.length === 0 && <p className="text-xs text-muted-foreground">No replies yet.</p>}
        </div>
      )}

      {user?.id && (
        <div className="mt-2 flex items-end gap-2">
          <CornerDownRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="flex-1">
            <textarea
              value={text}
              onChange={(e) => { setText(e.target.value.slice(0, MAX_LEN)); setReplyError(''); }}
              placeholder="Write a reply…"
              rows={1}
              className="w-full resize-none rounded-lg border border-border bg-background px-3 py-1.5 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none"
            />
            <div className={`mt-0.5 text-right text-[11px] ${MAX_LEN - text.length < 20 ? 'text-destructive' : MAX_LEN - text.length < 50 ? 'text-warning' : 'text-muted-foreground'}`}>
              {MAX_LEN - text.length} left
            </div>
            {replyError && (
              <p className="mt-1 text-xs text-destructive">{replyError}</p>
            )}
          </div>
          <button
            onClick={submit}
            disabled={!text.trim() || posting}
            className="flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-40"
          >
            {posting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          </button>
        </div>
      )}
    </div>
  );
}