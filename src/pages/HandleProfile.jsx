import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';

// Resolves a collector handle (from a subdomain visit) to their DID and
// forwards to their profile. Falls back to home if the handle is unknown.
export default function HandleProfile() {
  const { handle } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await base44.functions.invoke('resolveUser', { handle });
        if (!active) return;
        const body = res?.data ?? res;
        if (body?.found && body.did) navigate(`/profile/${body.did}`, { replace: true });
        else navigate('/', { replace: true });
      } catch {
        if (active) navigate('/', { replace: true });
      }
    })();
    return () => { active = false; };
  }, [handle]);

  return (
    <div className="flex justify-center py-24">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
    </div>
  );
}