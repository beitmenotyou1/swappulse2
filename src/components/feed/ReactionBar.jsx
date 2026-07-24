import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { ensureUserDid, stampRecord, NSID } from '@/lib/atproto';

const REACTIONS = {
  insane_pull: { emoji: '🔥', label: 'Insane Pull' },
  jealous: { emoji: '😏', label: 'Jealous' },
  congrats: { emoji: '🎉', label: 'Congrats' },
  trade_interest: { emoji: '🤝', label: 'Trade Interest' },
  gratz_set: { emoji: '🏆', label: 'Gratz Set' },
  better_luck: { emoji: '🍀', label: 'Better Luck' },
  wow: { emoji: '🤯', label: 'Wow' },
};

const BY_TYPE = {
  pack_opening: ['insane_pull', 'jealous', 'better_luck', 'wow'],
  trade: ['trade_interest', 'congrats', 'wow'],
  showcase: ['congrats', 'wow', 'jealous', 'gratz_set'],
  text: ['congrats', 'wow'],
};

export default function ReactionBar({ post, initial }) {
  const [counts, setCounts] = useState(initial?.counts || {});
  const [mine, setMine] = useState(initial?.mine || null);
  const [mineId, setMineId] = useState(initial?.mineId || null);
  const [pending, setPending] = useState(false);
  const types = BY_TYPE[post.post_type] || BY_TYPE.text;

  const toggle = async (type) => {
    if (pending) return;
    setPending(true);
    const prevCounts = counts;
    const prevMine = mine;
    const prevMineId = mineId;

    if (mine === type) {
      // remove my reaction
      setCounts((c) => ({ ...c, [type]: Math.max(0, (c[type] || 0) - 1) }));
      setMine(null);
      setMineId(null);
      try {
        if (mineId) await base44.entities.Reaction.delete(mineId);
      } catch {
        setCounts(prevCounts);
        setMine(prevMine);
        setMineId(prevMineId);
      }
    } else {
      // switch or add
      if (mine && mineId) {
        setCounts((c) => ({
          ...c,
          [mine]: Math.max(0, (c[mine] || 0) - 1),
          [type]: (c[type] || 0) + 1,
        }));
        try {
          await base44.entities.Reaction.delete(mineId);
        } catch {
          /* best-effort */
        }
      } else {
        setCounts((c) => ({ ...c, [type]: (c[type] || 0) + 1 }));
      }
      setMine(type);
      setMineId(null);
      try {
        const { did, signingKey } = await ensureUserDid();
        const me = await base44.auth.me();
        const stamped = await stampRecord(
          {
            subject: post.at_uri || `at://swappulse/post/${post.id}`,
            post_id: post.id,
            reaction_type: type,
            target_card_uri: post.card_id || undefined,
            reactor_name: me?.full_name || '',
            reactor_handle: me?.email?.split('@')[0] || '',
          },
          NSID.REACTION,
          did,
          signingKey,
        );
        const created = await base44.entities.Reaction.create(stamped);
        setMineId(created.id);
      } catch {
        setCounts(prevCounts);
        setMine(prevMine);
        setMineId(prevMineId);
      }
    }
    setPending(false);
  };

  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {types.map((t) => {
        const r = REACTIONS[t];
        const active = mine === t;
        const count = counts[t] || 0;
        return (
          <button
            key={t}
            onClick={() => toggle(t)}
            disabled={pending}
            title={r.label}
            className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition disabled:opacity-50 ${
              active
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border text-muted-foreground hover:bg-secondary'
            }`}
          >
            <span>{r.emoji}</span>
            {count > 0 && <span className="font-semibold">{count}</span>}
          </button>
        );
      })}
    </div>
  );
}