// Server-side post visibility policy. This is the confidentiality boundary for
// local SwapPulse posts. AT Protocol repositories are public, so non-public
// posts must remain local and every service-role read must pass through this
// policy before returning records to a caller.

export function postScope(post: any): 'public' | 'followers' | 'mentioned' {
  const scope = String(post?.visibility_scope || 'public').toLowerCase();
  if (scope === 'followers' || scope === 'mentioned') return scope;
  return 'public';
}

export async function canViewPostServer(svc: any, post: any, viewer: any): Promise<boolean> {
  if (!post) return false;
  if (viewer?.role === 'admin') return true;

  const viewerDid = String(viewer?.did || '');
  const isOwner = !!viewer && (
    post.created_by_id === viewer.id || (!!viewerDid && post.did === viewerDid)
  );
  if (isOwner) return true;

  const scope = postScope(post);
  if (scope === 'public') return true;
  if (!viewerDid || !post.did) return false;

  if (scope === 'mentioned') {
    return Array.isArray(post.mentioned_dids) && post.mentioned_dids.includes(viewerDid);
  }

  if (scope === 'followers') {
    const rows = await svc.entities.Follow
      .filter({ did: viewerDid, subject_did: post.did }, '-created_date', 1)
      .catch(() => []);
    return !!rows?.length;
  }

  return false;
}

export async function filterVisiblePostsServer(svc: any, posts: any[], viewer: any): Promise<any[]> {
  const visible: any[] = [];
  for (const post of posts || []) {
    if (await canViewPostServer(svc, post, viewer)) visible.push(post);
  }
  return visible;
}
