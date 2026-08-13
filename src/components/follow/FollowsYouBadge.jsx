import React, { useEffect, useState } from 'react';
import { UserCheck } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { ensureUserDid } from '@/lib/atproto';

// Shows a "Follows you" badge when the profile owner (subjectDid) follows
// the current user — helps spot mutual connections across the network.
export default function FollowsYouBadge({ subjectDid }) {
  const [followsYou, setFollowsYou] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!subjectDid) return;
      const me = await base44.auth.me().catch(() => null);
      const { did: myDid } = await ensureUserDid().catch(() => ({ did: me?.did || '' }));
      if (!active || !myDid || myDid === subjectDid) return;
      const records = await base44.entities.Follow.filter({
        did: subjectDid,
        subject_did: myDid,
      }).catch(() => []);
      if (active) setFollowsYou(records.length > 0);
    })();
    return () => { active = false; };
  }, [subjectDid]);

  if (!followsYou) return null;

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs font-semibold text-secondary-foreground">
      <UserCheck className="h-3 w-3" />
      Follows you
    </span>
  );
}