import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Flame, Frown, PartyPopper, ArrowLeftRight, Award, Dices, Sparkles } from 'lucide-react';

const REACTION_TYPES = [
  { key: 'insane_pull', icon: Flame, label: 'Insane pull' },
  { key: 'jealous', icon: Frown, label: 'Jealous' },
  { key: 'congrats', icon: PartyPopper, label: 'Congrats' },
  { key: 'trade_interest', icon: ArrowLeftRight, label: 'Trade interest' },
  { key: 'gratz_set', icon: Award, label: 'Gratz on the set' },
  { key: 'better_luck', icon: Dices, label: 'Better luck' },
  { key: 'wow', icon: Sparkles, label: 'Wow' },
];

export default function CommentReactions({ post, user, compact = false }) {
  const [counts, setCounts] = useState({});
  const [myReaction, setMyReaction] = useState(null);
  const [busy, setBusy] = useState(false);

  const loadReactions = useCallback(async () => {
    try {
      const reactions = await base44.entities.Reaction.filter(
        { post_id: post.id },
        '-created_date',
        200
      );
      const c = {};
      let mine = null;
      reactions.forEach((r) => {
        c[r.reaction_type] = (c[r.reaction_type] || 0) + 1;
        if (r.created_by_id === user?.id) mine = r.reaction_type;
      });
      setCounts(c);
      setMyReaction(mine);
    } catch {
      // fail silently
    }
  }, [post.id, user?.id]);

  useEffect(() => {
    loadReactions();
  }, [loadReactions]);

  const toggle = async (typeKey) => {
    if (busy || !user) return;
    setBusy(true);
    try {
      if (myReaction === typeKey) {
        // Remove existing reaction of same type
        const existing = await base44.entities.Reaction.filter(
          { post_id: post.id, reaction_type: typeKey, created_by_id: user.id },
          '-created_date',
          1
        );
        if (existing[0]) await base44.entities.Reaction.delete(existing[0].id);
        setMyReaction(null);
        setCounts((c) => ({ ...c, [typeKey]: Math.max(0, (c[typeKey] || 0) - 1) }));
      } else {
        // Remove previous reaction if switching
        if (myReaction) {
          const prev = await base44.entities.Reaction.filter(
            { post_id: post.id, reaction_type: myReaction, created_by_id: user.id },
            '-created_date',
            1
          );
          if (prev[0]) await base44.entities.Reaction.delete(prev[0].id);
          setCounts((c) => ({ ...c, [myReaction]: Math.max(0, (c[myReaction] || 0) - 1) }));
        }
        // Create new reaction
        await base44.entities.Reaction.create({
          subject: post.at_uri || `at://swappulse/post/${post.id}`,
          post_id: post.id,
          reaction_type: typeKey,
          reactor_name: user?.full_name || '',
          reactor_handle: user?.handle || '',
          reactor_avatar: user?.avatar_url || '',
        });
        setMyReaction(typeKey);
        setCounts((c) => ({ ...c, [typeKey]: (c[typeKey] || 0) + 1 }));
      }
    } catch {
      // fail silently
    } finally {
      setBusy(false);
    }
  };

  const iconSize = compact ? 'h-3.5 w-3.5' : 'h-4 w-4';

  return (
    <div className="flex flex-wrap items-center gap-1">
      {REACTION_TYPES.map(({ key, icon: Icon, label }) => {
        const count = counts[key] || 0;
        const isMine = myReaction === key;
        if (compact && count === 0 && !isMine) return null;
        return (
          <button
            key={key}
            onClick={() => toggle(key)}
            disabled={busy}
            title={label}
            className={`flex items-center gap-1 rounded-full px-1.5 py-0.5 text-xs transition-colors disabled:opacity-40 ${
              isMine
                ? 'bg-primary/15 text-primary'
                : 'text-muted-foreground hover:bg-secondary'
            }`}
          >
            <Icon className={iconSize} />
            {count > 0 && <span className="font-medium">{count}</span>}
          </button>
        );
      })}
    </div>
  );
}