// Centralized notification preference filter. Loads the recipient's
// NotificationPreference record and decides whether a notification from
// `actorDid` should be delivered. Used by notify-interaction (gates the
// in-app Notification record) and by notificationDispatcher (gates push)
// so the preference is honored regardless of trigger source.
//
// Defaults (no preference record yet): everyone, on-site-only false, paused
// false — all notifications deliver until the user changes a setting.
//
// `paused` drops everything. `who_filter === 'followed_only'` and
// `on_site_only === true` are actor-based filters: when `actorDid` is absent
// (system-generated notifications like price alerts, achievements, trade
// matches), only `paused` applies — relationship/origin filters are skipped.

export interface FilterInput {
  recipientDid: string;
  actorDid?: string;
}

export interface FilterResult {
  allowed: boolean;
  reason: string;
}

const DEFAULT_PREF = { who_filter: 'everyone', on_site_only: false, paused: false };

export async function shouldDeliverNotification(
  svc: any,
  input: FilterInput
): Promise<FilterResult> {
  const { recipientDid, actorDid } = input;
  if (!recipientDid) return { allowed: true, reason: 'no_recipient' };

  // Load the recipient's preference record (service role bypasses RLS).
  let pref = DEFAULT_PREF;
  try {
    const records = await svc.entities.NotificationPreference.filter(
      { did: recipientDid },
      '-updated_date',
      1
    );
    if (records && records.length > 0) {
      pref = {
        who_filter: records[0].who_filter || 'everyone',
        on_site_only: !!records[0].on_site_only,
        paused: !!records[0].paused,
      };
    }
  } catch (e) {
    console.error('notificationFilter: load pref failed', e?.message || e);
    // On error, fail open (deliver) — don't silently mute users.
    return { allowed: true, reason: 'pref_load_error' };
  }

  // Master pause drops everything.
  if (pref.paused) return { allowed: false, reason: 'paused' };

  // Actor-based filters only apply when there is an actor.
  if (!actorDid || actorDid === recipientDid) {
    return { allowed: true, reason: 'no_actor_or_self' };
  }

  // Relationship filter: only people the recipient follows.
  if (pref.who_filter === 'followed_only') {
    try {
      const follows = await svc.entities.Follow.filter(
        { did: recipientDid, subject_did: actorDid },
        '-created_date',
        1
      );
      if (!follows || follows.length === 0) {
        return { allowed: false, reason: 'not_followed' };
      }
    } catch (e) {
      console.error('notificationFilter: follow check failed', e?.message || e);
      // Fail open on lookup error.
      return { allowed: true, reason: 'follow_check_error' };
    }
  }

  // Origin filter: only on-site (registered SwapPulse) users.
  if (pref.on_site_only) {
    try {
      const users = await svc.entities.User.filter({ did: actorDid }, '-created_date', 1);
      if (!users || users.length === 0) {
        return { allowed: false, reason: 'off_site_actor' };
      }
    } catch (e) {
      console.error('notificationFilter: on-site check failed', e?.message || e);
      return { allowed: true, reason: 'onsite_check_error' };
    }
  }

  return { allowed: true, reason: 'allowed' };
}