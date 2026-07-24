import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { ensureUserDid, stampRecord, NSID } from '@/lib/atproto';
import { TrendingUp, TrendingDown, Minus, Clock } from 'lucide-react';
import Avatar from '@/components/Avatar';

const VOTES = [
  { key: 'bullish', label: 'Bullish', icon: TrendingUp, bar: 'bg-success', text: 'text-success' },
  { key: 'bearish', label: 'Bearish', icon: TrendingDown, bar: 'bg-destructive', text: 'text-destructive' },
  { key: 'neutral', label: 'Neutral', icon: Minus, bar: 'bg-muted-foreground', text: 'text-muted-foreground' },
];

const DIR_META = {
  bullish: { label: 'Bullish', icon: TrendingUp, cls: 'text-success' },
  bearish: { label: 'Bearish', icon: TrendingDown, cls: 'text-destructive' },
  neutral: { label: 'Neutral', icon: Minus, cls: 'text-muted-foreground' },
};

function timeLeft(expiresAt) {
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return 'Closed';
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (d > 0) return `${d}d ${h}h left`;
  if (h > 0) return `${h}h ${m}m left`;
  return `${m}m left`;
}

export default function PollCard({ poll, myVote, myVoteId, user }) {
  const [tally, setTally] = useState(poll.vote_counts || { bullish: 0, bearish: 0, neutral: 0 });
  const [total, setTotal] = useState(poll.total_votes || 0);
  const [mine, setMine] = useState(myVote || null);
  const [mineId, setMineId] = useState(myVoteId || null);
  const [pending, setPending] = useState(false);

  const expired = new Date(poll.expires_at).getTime() <= Date.now();
  const resolved = !!poll.outcome;
  const dir = DIR_META[poll.direction] || DIR_META.neutral;

  const cast = async (key) => {
    if (pending || resolved) return;
    setPending(true);
    const oldTally = tally;
    const oldTotal = total;
    const oldMine = mine;
    const oldMineId = mineId;

    let newTally, newTotal, newMine;
    if (mine === key) {
      newTally = { ...oldTally, [key]: Math.max(0, (oldTally[key] || 0) - 1) };
      newTotal = Math.max(0, oldTotal - 1);
      newMine = null;
    } else if (mine) {
      newTally = {
        ...oldTally,
        [mine]: Math.max(0, (oldTally[mine] || 0) - 1),
        [key]: (oldTally[key] || 0) + 1,
      };
      newTotal = oldTotal;
      newMine = key;
    } else {
      newTally = { ...oldTally, [key]: (oldTally[key] || 0) + 1 };
      newTotal = oldTotal + 1;
      newMine = key;
    }
    setTally(newTally);
    setTotal(newTotal);
    setMine(newMine);
    setMineId(null);
    try {
      if (oldMineId && oldMine !== key) {
        try { await base44.entities.SentimentVote.delete(oldMineId); } catch { /* best-effort */ }
      }
      if (newMine) {
        const { did, signingKey } = await ensureUserDid();
        const stamped = await stampRecord(
          {
            poll_ref: poll.at_uri,
            poll_id: poll.id,
            vote: key,
            voter_name: user?.full_name || '',
            voter_handle: user?.email?.split('@')[0] || '',
          },
          NSID.SENTIMENT_VOTE,
          did,
          signingKey,
        );
        const created = await base44.entities.SentimentVote.create(stamped);
        setMineId(created.id);
      } else if (oldMineId) {
        try { await base44.entities.SentimentVote.delete(oldMineId); } catch { /* best-effort */ }
      }
      await base44.entities.SentimentPoll.update(poll.id, {
        vote_counts: newTally,
        total_votes: newTotal,
      });
    } catch (e) {
      setTally(oldTally);
      setTotal(oldTotal);
      setMine(oldMine);
      setMineId(oldMineId);
    }
    setPending(false);
  };

  const pct = (k) => (total > 0 ? Math.round(((tally[k] || 0) / total) * 100) : 0);
  const outcomeCls =
    poll.outcome === 'correct'
      ? 'bg-success/15 text-success'
      : poll.outcome === 'incorrect'
      ? 'bg-destructive/15 text-destructive'
      : 'bg-muted text-muted-foreground';

  return (
    <article className="rounded-2xl border border-border bg-card p-4 shadow-base">
      <div className="flex items-start gap-3">
        {poll.card_image && (
          <img src={poll.card_image} alt={poll.card_name} className="h-16 w-12 shrink-0 rounded object-cover" />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-snug">{poll.question}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Avatar name={poll.author_name} size={18} />
            <span className="truncate">{poll.author_name}</span>
            <span className={`inline-flex items-center gap-0.5 font-medium ${dir.cls}`}>
              <dir.icon className="h-3 w-3" />
              {dir.label}
            </span>
          </div>
        </div>
        {resolved ? (
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${outcomeCls}`}>
            {poll.outcome}
          </span>
        ) : (
          <span className="shrink-0 inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            {timeLeft(poll.expires_at)}
          </span>
        )}
      </div>

      <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-muted">
        {VOTES.map((v) => (
          <div key={v.key} className={v.bar} style={{ width: `${pct(v.key)}%` }} />
        ))}
      </div>
      <div className="mt-1.5 flex items-center justify-between text-xs">
        <div className="flex gap-3">
          {VOTES.map((v) => (
            <span key={v.key} className={v.text}>
              {v.label} {pct(v.key)}%
            </span>
          ))}
        </div>
        <span className="text-muted-foreground">{total} vote{total === 1 ? '' : 's'}</span>
      </div>

      {!resolved && (
        <div className="mt-3 grid grid-cols-3 gap-2">
          {VOTES.map((v) => {
            const active = mine === v.key;
            return (
              <button
                key={v.key}
                disabled={pending}
                onClick={() => cast(v.key)}
                className={`flex items-center justify-center gap-1 rounded-full border py-1.5 text-xs font-medium transition disabled:opacity-50 ${
                  active ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-secondary'
                }`}
              >
                <v.icon className="h-3.5 w-3.5" /> {v.label}
              </button>
            );
          })}
        </div>
      )}

      {resolved && poll.outcome && (
        <p className="mt-2 text-xs text-muted-foreground">
          {poll.outcome === 'correct'
            ? 'Prediction confirmed by the market.'
            : poll.outcome === 'incorrect'
            ? 'Market moved against the prediction.'
            : 'Inconclusive — price data was unavailable.'}
        </p>
      )}
    </article>
  );
}