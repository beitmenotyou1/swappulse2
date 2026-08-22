// get-sync-status — returns the calling user's per-category AT Protocol sync
// state so the Settings Sync Dashboard can surface real-time progress.
//
// Reads the User entity's backfill_complete flags, cursors, and migration_steps
// to derive a status for each category (posts, likes, reposts, lists, follows,
// notifications). Also counts the local records synced per category so users
// see concrete numbers (e.g. "1,247 posts synced").
//
// Output: {
//   ok, migrated, linked,
//   categories: {
//     posts:        { status, complete, count, error },
//     likes:        { ... },
//     reposts:      { ... },
//     lists:        { ... },
//     follows:      { ... },
//     notifications:{ ... },
//   },
//   profile_sync: { synced_at, failed_at, fail_count, pending }
// }

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

type CategoryStatus = 'complete' | 'in_progress' | 'failed' | 'not_started';

interface CategoryState {
  status: CategoryStatus;
  complete: boolean;
  count: number;
  error: string;
}

function deriveStatus(complete: boolean, stepStatus: string | undefined, hasCursor: boolean): CategoryStatus {
  if (stepStatus === 'failed') return 'failed';
  if (complete) return 'complete';
  if (stepStatus === 'running' || hasCursor) return 'in_progress';
  if (stepStatus === 'success' && !complete) return 'in_progress'; // first batch done, more to go
  return 'not_started';
}

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const svc = base44.asServiceRole;
    const did = user.did || '';
    const steps = user.migration_steps || {};

    // Count local records per category. Use filter with a limit of 1 to get
    // the total count without loading all records — the SDK returns the total
    // count in the response metadata. Actually, the SDK list/filter returns
    // an array; we use a large limit and .length as an approximation. For
    // accuracy without loading everything, we filter with limit 5000 (the
    // platform ceiling) and use .length.
    const countFor = async (entity: string, query: any): Promise<number> => {
      if (!did) return 0;
      try {
        const records = await svc.entities[entity].filter(query, '-created_date', 5000).catch(() => []);
        return records?.length || 0;
      } catch {
        return 0;
      }
    };

    const [postCount, likeCount, repostCount, listCount, followCount, notifCount] = await Promise.all([
      countFor('Post', { did }),
      countFor('Like', { did }),
      countFor('Repost', { did }),
      countFor('BlueskyList', { did }),
      countFor('Follow', { did }),
      countFor('Notification', { recipient_did: did }),
    ]);

    const categories: Record<string, CategoryState> = {
      posts: {
        status: deriveStatus(!!user.post_backfill_complete, steps.post_backfill?.status, !!user.post_backfill_cursor),
        complete: !!user.post_backfill_complete,
        count: postCount,
        error: steps.post_backfill?.error || '',
      },
      likes: {
        status: deriveStatus(!!user.likes_backfill_complete, steps.likes_backfill?.status, !!user.likes_backfill_cursor),
        complete: !!user.likes_backfill_complete,
        count: likeCount,
        error: steps.likes_backfill?.error || '',
      },
      reposts: {
        status: deriveStatus(!!user.reposts_backfill_complete, steps.reposts_backfill?.status, !!user.reposts_backfill_cursor),
        complete: !!user.reposts_backfill_complete,
        count: repostCount,
        error: steps.reposts_backfill?.error || '',
      },
      lists: {
        status: deriveStatus(!!user.lists_backfill_complete, steps.lists_backfill?.status, !!user.lists_backfill_cursor),
        complete: !!user.lists_backfill_complete,
        count: listCount,
        error: steps.lists_backfill?.error || '',
      },
      follows: {
        status: deriveStatus(true, steps.graph_import?.status, false),
        complete: steps.graph_import?.status === 'success',
        count: followCount,
        error: steps.graph_import?.error || '',
      },
      notifications: {
        status: deriveStatus(!!user.notifications_backfill_complete, steps.notification_import?.status, !!user.notifications_backfill_cursor),
        complete: !!user.notifications_backfill_complete,
        count: notifCount,
        error: steps.notification_import?.error || '',
      },
    };

    return Response.json({
      ok: true,
      linked: !!user.bsky_handle,
      migrated: !!user.migrated_from_bluesky,
      categories,
      profile_sync: {
        synced_at: user.profile_synced_at || '',
        failed_at: user.profile_sync_failed_at || '',
        fail_count: user.profile_sync_fail_count || 0,
        pending: !!user.profile_sync_pending,
      },
      graph_reconciled_at: user.graph_reconciled_at || '',
    });
  } catch (error) {
    console.error('get-sync-status error:', error?.message || error);
    return Response.json({ error: error?.message || 'Unknown error' }, { status: 500 });
  }
}