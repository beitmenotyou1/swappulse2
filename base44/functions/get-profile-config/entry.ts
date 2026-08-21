// get-profile-config — returns a viewer-filtered view of a collector's
// ProfileConfig. Reads the target's config via the service role (bypassing
// owner-only RLS), determines whether the caller is a friend (mutual accepted
// Friendship) or a follower (Follow) of the target, and strips any field whose
// visibility (public / friends / followers / private) the viewer isn't
// permitted to see. Trade-detail fields (trade_values, trade_partners,
// trade_dates) are resolved into a `tradeFields` permit list so the trade
// history components can mask withheld details without hiding the whole tab.
// Layout fields (theme, section_order, block_order, hidden_sections) are
// always returned so the visitor's profile renders in the owner's chosen
// arrangement. Guests only see public fields.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

const DEFAULT_FIELD_VISIBILITY: Record<string, string> = {
  bio: 'public',
  pronouns: 'public',
  interests: 'public',
  favourite_pokemon: 'public',
  favourite_sets: 'public',
  location: 'followers',
  website: 'public',
  social_links: 'public',
  contact_email: 'followers',
  milestones: 'public',
  trade_values: 'followers',
  trade_partners: 'followers',
  trade_dates: 'public',
};

const PERSONAL_FIELDS = [
  'bio', 'pronouns', 'interests', 'favourite_pokemon', 'favourite_sets',
  'location', 'website', 'social_links', 'contact_email', 'milestones',
];
const TRADE_FIELDS = ['trade_values', 'trade_partners', 'trade_dates'];

function defaultFor(field: string): any {
  if (['interests', 'favourite_pokemon', 'favourite_sets', 'social_links', 'milestones'].includes(field)) return [];
  return '';
}

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({} as any));
    const targetDid = body?.did;
    if (!targetDid) return Response.json({ error: 'did required' }, { status: 400 });

    // Viewer identity (may be a guest — auth.me() throws when unauthenticated).
    let viewerDid = '';
    let isOwner = false;
    try {
      const me = await base44.auth.me();
      if (me) {
        viewerDid = me.did || '';
        isOwner = !!viewerDid && viewerDid === targetDid;
      }
    } catch {
      /* guest viewer */
    }

    // Load the target's config (service role bypasses owner-only RLS).
    const configs = await base44.asServiceRole.entities.ProfileConfig.filter(
      { did: targetDid },
      '-created_date',
      1,
    );
    const raw = configs[0] || null;

    // Relationship checks — only meaningful for authenticated non-owner viewers.
    let isFollower = false;
    let isFriend = false;
    if (viewerDid && !isOwner) {
      try {
        const follows = await base44.asServiceRole.entities.Follow.filter(
          { did: viewerDid, subject_did: targetDid },
          '-created_date',
          1,
        );
        isFollower = follows.length > 0;
      } catch {
        /* ignore — treat as non-follower */
      }
      try {
        const [mine, theirs] = await Promise.all([
          base44.asServiceRole.entities.Friendship.filter(
            { did: viewerDid, friend_did: targetDid, status: 'accepted' },
            '-created_date',
            1,
          ),
          base44.asServiceRole.entities.Friendship.filter(
            { did: targetDid, friend_did: viewerDid, status: 'accepted' },
            '-created_date',
            1,
          ),
        ]);
        isFriend = mine.length > 0 && theirs.length > 0;
      } catch {
        /* ignore — treat as non-friend */
      }
    }

    const visibility = { ...DEFAULT_FIELD_VISIBILITY, ...(raw?.field_visibility || {}) };
    const canSee = (field: string): boolean => {
      if (isOwner) return true;
      const v = visibility[field] || 'public';
      if (v === 'public') return true;
      if (v === 'friends') return isFriend;
      if (v === 'followers') return isFollower;
      return false; // private
    };

    const personal: Record<string, any> = {};
    for (const f of PERSONAL_FIELDS) {
      if (canSee(f)) personal[f] = raw?.[f] ?? defaultFor(f);
    }

    return Response.json({
      found: !!raw,
      isOwner,
      isFollower,
      isFriend,
      theme: raw?.theme === 'reddit' ? 'default' : (raw?.theme || 'default'),
      section_order: raw?.section_order || null,
      block_order: raw?.block_order || null,
      hidden_sections: raw?.hidden_sections || [],
      personal,
      visibleFields: PERSONAL_FIELDS.filter((f) => canSee(f)),
      tradeFields: TRADE_FIELDS.filter((f) => canSee(f)),
    });
  } catch (error) {
    return Response.json({ error: error?.message || 'Unknown error' }, { status: 500 });
  }
}