import React, { useState, useEffect } from 'react';
import { Globe, Loader2, Check, AlertCircle } from 'lucide-react';
import { base44 } from '@/api/base44Client';

// StandardSiteSection — admin controls for Standard.site publishing.
// Lets the admin publish the SwapPulse site.standard.publication record and
// view its current state.
export default function StandardSiteSection() {
  const [pubUri, setPubUri] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const rows = await base44.entities.StandardSiteConfig.list('-created_date', 1);
        if (alive && rows?.length > 0) setPubUri(rows[0].publication_uri || '');
      } catch { /* ignore */ }
    })();
    return () => { alive = false; };
  }, []);

  const publish = async () => {
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const res = await base44.functions.invoke('publish-standard-publication', {});
      const data = res?.data ?? res;
      if (data?.uri) {
        setPubUri(data.uri);
        setSuccess('SwapPulse publication published successfully.');
      } else if (data?.error) {
        setError(data.error);
      }
    } catch (e) {
      setError(e.response?.data?.error || e.message || 'Failed to publish');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center gap-2">
        <Globe className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-bold">Standard.site Publication</h3>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">
        Publishes the SwapPulse site.standard.publication record to the PDS so journals, card reviews, and binder
        descriptions are portable and discoverable across the ATmosphere. Also verifies the publication against
        the swappulse.org domain via the /.well-known/site.standard.publication route.
      </p>

      {pubUri && (
        <div className="mb-3 rounded-lg border border-border bg-secondary p-2">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Current publication URI</p>
          <p className="mt-0.5 break-all font-mono text-xs">{pubUri}</p>
        </div>
      )}

      {error && (
        <div className="mb-3 flex items-center gap-1.5 text-xs text-destructive">
          <AlertCircle className="h-3.5 w-3.5" /> {error}
        </div>
      )}
      {success && (
        <div className="mb-3 flex items-center gap-1.5 text-xs text-success">
          <Check className="h-3.5 w-3.5" /> {success}
        </div>
      )}

      <button
        onClick={publish}
        disabled={loading}
        className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-bold text-white hover:bg-primary/90 disabled:opacity-50"
      >
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Globe className="h-3.5 w-3.5" />}
        {pubUri ? 'Re-publish' : 'Publish Publication'}
      </button>
    </div>
  );
}