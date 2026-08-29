import React, { useEffect, useState } from 'react';
import { X, BadgeCheck, Loader2, Copy, Check, Globe } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { ensureUserDid, stampRecord } from '@/lib/atproto';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/lib/AuthContext';

const HANDLE_CLAIM_NSID = 'org.swappulse.handleClaim';

// Handle migration modal. The user enters a domain they own, publishes the
// shown TXT record to their DNS, then taps Verify — SwapPulse looks up
// _atproto.<domain> and, on match, persists a verified HandleClaim and
// updates the user's handle.
export default function DomainHandleModal({ onClose }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [domain, setDomain] = useState(user?.custom_handle || '');
  const [did, setDid] = useState('');
  const [signingKey, setSigningKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    ensureUserDid()
      .then((r) => { setDid(r.did); setSigningKey(r.signingKey); })
      .catch(() => {});
  }, []);

  const cleanDomain = domain
    .trim()
    .toLowerCase()
    .replace(/^@/, '')
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '');
  const txtName = `_atproto.${cleanDomain}`;
  const txtValue = `did=${did}`;
  const defaultHandle = user?.custom_handle || user?.username || user?.bsky_handle || 'collector';

  const copy = (text) => {
    navigator.clipboard?.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const verify = async () => {
    if (!cleanDomain || !did || busy) return;
    setBusy(true);
    try {
      const res = await base44.functions.invoke('verifyHandleClaim', { domain: cleanDomain, did });
      const data = res?.data || res;
      if (!data?.verified) {
        toast({
          title: 'Verification failed',
          description: `No did=${did} found at _atproto.${cleanDomain}. Add the TXT record and retry.`,
          variant: 'destructive',
        });
        return;
      }
      const now = new Date().toISOString();
      const payload = {
        domain: cleanDomain,
        did,
        verification_method: res.method || 'txt_record',
        status: 'verified',
        verified_at: now,
        claimed_at: now,
        legacy_handle: `${user?.custom_handle || user?.username || user?.bsky_handle || 'collector'}.swappulse.org`,
      };
      const stamped = await stampRecord(payload, HANDLE_CLAIM_NSID, did, signingKey);
      await base44.entities.HandleClaim.create(stamped);
      // Push the handle to the PDS so it propagates to the wider AT Protocol.
      const upd = await base44.functions.invoke('update-pds-handle', { handle: cleanDomain });
      const updData = upd?.data || upd;
      if (!updData?.ok) {
        throw new Error(updData?.error || 'PDS handle update failed');
      }
      await base44.auth.updateMe({ custom_handle: cleanDomain, handle_verified: true, bsky_handle: cleanDomain });
      toast({ title: 'Handle updated', description: `You are now @${cleanDomain} on Bluesky` });
      onClose?.();
    } catch (e) {
      toast({ title: 'Could not verify', description: e.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md animate-slide-up rounded-2xl border border-border bg-card p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <Globe className="h-5 w-5 text-primary" /> Update Your Handle
          </h2>
          <button aria-label="Close handle settings" onClick={onClose} className="rounded-full p-1.5 hover:bg-secondary">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-3">
          <div className="rounded-xl bg-secondary px-3 py-2 text-xs text-muted-foreground">
            Current: <b className="text-foreground">@{defaultHandle}</b>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-muted-foreground">New handle</label>
            <div className="flex items-center gap-1.5 rounded-xl border border-border bg-secondary px-3 py-2.5">
              <span className="text-sm text-muted-foreground">@</span>
              <input
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder="yourbrand.com"
                className="flex-1 bg-transparent text-sm outline-none"
              />
              {user?.handle_verified && <BadgeCheck className="h-4 w-4 text-success" />}
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">ℹ️ You must own this domain.</p>
          </div>

          {did && (
            <div className="rounded-xl border border-border p-3">
              <p className="mb-2 text-xs font-semibold">Step 1: Add this TXT record to your DNS</p>
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between gap-2 rounded-lg bg-secondary px-2.5 py-2">
                  <span className="text-muted-foreground">Name</span>
                  <code className="font-mono text-foreground">{txtName}</code>
                  <button onClick={() => copy(txtName)} className="text-muted-foreground hover:text-foreground">
                    {copied ? <Check className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                </div>
                <div className="flex items-center justify-between gap-2 rounded-lg bg-secondary px-2.5 py-2">
                  <span className="text-muted-foreground">Type</span>
                  <code className="font-mono text-foreground">TXT</code>
                </div>
                <div className="flex items-center justify-between gap-2 rounded-lg bg-secondary px-2.5 py-2">
                  <span className="text-muted-foreground">Value</span>
                  <code className="font-mono text-foreground">{txtValue}</code>
                  <button onClick={() => copy(txtValue)} className="text-muted-foreground hover:text-foreground">
                    {copied ? <Check className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">
                Verification also accepts a file at <code>https://{cleanDomain || 'yourdomain'}/.well-known/atproto-did</code> containing your DID.
              </p>
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button
              onClick={onClose}
              className="flex-1 rounded-xl border border-border py-3 text-sm font-semibold hover:bg-secondary"
            >
              Cancel
            </button>
            <button
              onClick={verify}
              disabled={!cleanDomain || !did || busy}
              className="flex flex-[1.5] items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground disabled:opacity-50"
            >
              {busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Verifying…</> : 'Verify'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}