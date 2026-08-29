import React, { useEffect, useState } from 'react';
import { Loader2, Search, ShieldCheck, X } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { ensureUserDid } from '@/lib/atproto';
import { bridgeVouch } from '@/lib/federatedBridge';
import Avatar from '@/components/Avatar';
import SettingSelect from '@/components/settings/SettingSelect';

const RELATIONSHIPS = [
  { value: 'trade_partner', label: 'Trade Partner' },
  { value: 'repeat_trader', label: 'Repeat Trader' },
  { value: 'personal_acquaintance', label: 'Personal Acquaintance' },
  { value: 'community_member', label: 'Community Member' },
];

export default function VouchForm({ onCreated }) {
  const [handle, setHandle] = useState('');
  const [resolved, setResolved] = useState(null);
  const [myDid, setMyDid] = useState('');
  const [resolving, setResolving] = useState(false);
  const [resolveError, setResolveError] = useState('');
  const [relationship, setRelationship] = useState('trade_partner');
  const [context, setContext] = useState('');
  const [saving, setSaving] = useState(false);
  const [outgoing, setOutgoing] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const { did } = await ensureUserDid();
        setMyDid(did);
        const out = await base44.entities.Vouch.filter({ did }, '-created_date', 200);
        setOutgoing(out);
      } catch {
        /* ignore */
      }
    })();
  }, []);

  const isSelf = resolved && myDid && resolved.did === myDid;
  const alreadyVouched = resolved && outgoing.some((v) => v.vouched_did === resolved.did && !v.revoked_at);

  const resolve = async () => {
    if (!handle.trim()) return;
    setResolving(true);
    setResolveError('');
    setResolved(null);
    try {
      const res = await base44.functions.invoke('resolveUser', { handle: handle.trim() });
      if (res.data?.found) setResolved(res.data);
      else setResolveError('No collector found with that handle.');
    } catch (e) {
      setResolveError(e.message || 'Lookup failed');
    } finally {
      setResolving(false);
    }
  };

  const submit = async () => {
    if (!resolved || isSelf || !context.trim()) return;
    setSaving(true);
    try {
      const me = await base44.auth.me();
      const vouchData = {
        vouched_did: resolved.did,
        vouched_name: resolved.name,
        vouched_handle: resolved.handle,
        relationship,
        context: context.trim(),
        revocable: true,
        voucher_name: me?.full_name || '',
        voucher_handle: me?.custom_handle || (me?.custom_handle || me?.username || me?.bsky_handle || ''),
      };
      // bridgeVouch stamps the record locally AND creates it on the PDS
      const bridgedFields = await bridgeVouch(vouchData);
      await base44.entities.Vouch.create({ ...vouchData, ...bridgedFields });
      setHandle('');
      setResolved(null);
      setContext('');
      setRelationship('trade_partner');
      onCreated?.();
    } catch (e) {
      alert(e.message || 'Failed to vouch');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <h3 className="mb-3 flex items-center gap-1.5 font-bold">
        <ShieldCheck className="h-4 w-4 text-primary" /> Vouch for a collector
      </h3>
      <div className="flex gap-2">
        <div className="flex flex-1 items-center gap-1 rounded-lg border border-border bg-background px-3 py-2">
          <span className="text-muted-foreground">@</span>
          <input
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            placeholder="collector handle"
            className="w-full bg-transparent text-sm outline-none"
            onKeyDown={(e) => {
              if (e.key === 'Enter') resolve();
            }}
           aria-label="collector handle"/>
        </div>
        <button
          onClick={resolve}
          disabled={resolving || !handle.trim()}
          className="flex items-center gap-1.5 rounded-lg bg-secondary px-3 py-2 text-sm font-semibold disabled:opacity-50"
        >
          {resolving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} Find
        </button>
      </div>
      {resolveError && <p className="mt-2 text-xs text-destructive">{resolveError}</p>}
      {resolved && (
        <div className="mt-3 rounded-lg border border-border bg-background p-2.5">
          <div className="flex items-center gap-2">
            <Avatar name={resolved.name} src={resolved.avatar} size={32} />
            <div className="flex-1">
              <p className="text-sm font-semibold">{resolved.name}</p>
              <p className="text-xs text-muted-foreground">@{resolved.handle}</p>
            </div>
            <button aria-label="Clear selected collector" onClick={() => setResolved(null)} className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>
          {isSelf && <p className="mt-2 text-xs text-destructive">You can't vouch for yourself.</p>}
          {!isSelf && alreadyVouched && <p className="mt-2 text-xs text-destructive">You've already vouched for this collector. Revoke your existing vouch first.</p>}
        </div>
      )}
      {resolved && !isSelf && !alreadyVouched && (
        <div className="mt-3 space-y-2">
          <SettingSelect
            value={relationship}
            onChange={setRelationship}
            label="Relationship"
            options={RELATIONSHIPS}
          />
          <textarea
            value={context}
            onChange={(e) => setContext(e.target.value)}
            placeholder="Why are you vouching? (required)"
            rows={2}
            maxLength={280}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
           aria-label="Why are you vouching? (required)"/>
          <button
            onClick={submit}
            disabled={saving || !context.trim()}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />} Vouch
          </button>
        </div>
      )}
    </div>
  );
}