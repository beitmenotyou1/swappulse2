import React from 'react';
import { X, Crown, Shield, Mic, MicOff, ArrowUpCircle, ArrowDownCircle, UserMinus } from 'lucide-react';
import LiveAvatar from '@/components/LiveAvatar';

// Host/mod admin panel — a bottom sheet listing every participant with
// per-row stage-management actions: promote to speaker, demote to listener,
// make mod, revoke mod, mute (muted_by_host), and remove (mark left).
// Open from the SpaceRoom bottom bar when isHost || isMod.
export default function SpaceAdminPanel({ open, onClose, participants, myDid, onPromote, onDemote, onMakeMod, onRevokeMod, onMute, onUnmute, onRemove }) {
  if (!open) return null;
  const active = participants.filter((p) => !p.left_at && p.did !== myDid);
  const onStage = active.filter((p) => ['host', 'co_host', 'mod', 'speaker'].includes(p.role));
  const audience = active.filter((p) => p.role === 'listener');

  const Row = ({ p }) => (
    <div className="flex items-center gap-2 rounded-xl border border-border bg-card p-2">
      <LiveAvatar did={p.did} name={p.participant_name} src={p.participant_avatar} size={36} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{p.participant_name || 'Collector'}</p>
        <p className="truncate text-[11px] capitalize text-muted-foreground">
          {p.role}{p.hand_raised ? ' · ✋ raised' : ''}{p.muted_by_host ? ' · muted by host' : ''}
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-1">
        {p.role === 'listener' && (
          <button onClick={() => onPromote(p)} title="Promote to speaker" className="rounded-lg bg-primary/10 p-1.5 text-primary hover:bg-primary/20">
            <ArrowUpCircle className="h-4 w-4" />
          </button>
        )}
        {['speaker', 'mod'].includes(p.role) && (
          <button onClick={() => onDemote(p)} title="Move to listener" className="rounded-lg bg-secondary p-1.5 text-muted-foreground hover:text-foreground">
            <ArrowDownCircle className="h-4 w-4" />
          </button>
        )}
        {p.role !== 'mod' && p.role !== 'host' && (
          <button onClick={() => onMakeMod(p)} title="Make mod" className="rounded-lg bg-secondary p-1.5 text-muted-foreground hover:text-primary">
            <Shield className="h-4 w-4" />
          </button>
        )}
        {p.role === 'mod' && (
          <button onClick={() => onRevokeMod(p)} title="Revoke mod" className="rounded-lg bg-secondary p-1.5 text-primary hover:text-foreground">
            <Shield className="h-4 w-4 opacity-50" />
          </button>
        )}
        {['speaker', 'mod'].includes(p.role) && (
          <button
            onClick={() => (p.muted_by_host ? onUnmute(p) : onMute(p))}
            title={p.muted_by_host ? 'Unmute' : 'Mute'}
            className={`rounded-lg p-1.5 hover:bg-destructive/10 ${p.muted_by_host ? 'bg-destructive/10 text-destructive' : 'bg-secondary text-muted-foreground'}`}
          >
            {p.muted_by_host ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </button>
        )}
        <button onClick={() => onRemove(p)} title="Remove" className="rounded-lg bg-secondary p-1.5 text-muted-foreground hover:text-destructive">
          <UserMinus className="h-4 w-4" />
        </button>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
      <div
        className="max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-border bg-background p-4 shadow-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-base font-bold"><Crown className="h-4 w-4 text-primary" /> Manage Space</h3>
          <button aria-label="Close space admin panel" onClick={onClose} className="rounded-full p-1.5 hover:bg-secondary"><X className="h-5 w-5" /></button>
        </div>
        <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">On stage ({onStage.length})</p>
        <div className="space-y-1.5">
          {onStage.length === 0 ? <p className="text-xs text-muted-foreground">Only you on stage.</p> : onStage.map((p) => <Row key={p.id} p={p} />)}
        </div>
        <p className="mt-4 mb-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">Listeners ({audience.length})</p>
        <div className="space-y-1.5">
          {audience.length === 0 ? <p className="text-xs text-muted-foreground">No listeners yet.</p> : audience.map((p) => <Row key={p.id} p={p} />)}
        </div>
      </div>
    </div>
  );
}