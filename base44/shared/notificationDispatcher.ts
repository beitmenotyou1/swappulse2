// Core notification dispatcher — shared by send-notification and other backend
// functions. Checks preferences, quiet hours, rate limits; constructs the deep
// link; creates a NotificationLog; sends web push to all active PushToken
// records for the recipient (falls back to legacy User.push_subscription).
import webPush from 'npm:web-push@3.6.7';
import { buildDeepLink } from './deepLinkRoutes.ts';
import { shouldDeliverNotification } from './notificationFilter.ts';

export interface SendNotificationInput {
  recipientDid: string;
  type: string;
  title: string;
  body: string;
  params: Record<string, unknown>;
  subjectUri?: string;
  imageUrl?: string;
  priority?: 'standard' | 'high';
  actorDid?: string;
}

const MAX_DAILY_PUSHES = 50;

interface QuietWindow {
  start: string;
  end: string;
  days?: number[];
  mode?: string;
}

function getTimeInTimezone(timezone: string): { time: string; dayOfWeek: number } {
  try {
    const now = new Date();
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone || 'UTC',
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const parts = fmt.formatToParts(now);
    const hour = (parts.find((p) => p.type === 'hour')?.value || '0').padStart(2, '0');
    const minute = (parts.find((p) => p.type === 'minute')?.value || '0').padStart(2, '0');
    const weekday = parts.find((p) => p.type === 'weekday')?.value || '';
    const dayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    return { time: `${hour}:${minute}`, dayOfWeek: dayMap[weekday] ?? 0 };
  } catch {
    const now = new Date();
    return {
      time: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
      dayOfWeek: now.getDay(),
    };
  }
}

function isTimeInRange(current: string, start: string, end: string): boolean {
  if (start <= end) return current >= start && current < end;
  return current >= start || current < end;
}

function isInQuietWindow(window: QuietWindow, timezone: string): boolean {
  const { time, dayOfWeek } = getTimeInTimezone(timezone);
  if (window.days && window.days.length > 0 && !window.days.includes(dayOfWeek)) return false;
  return isTimeInRange(time, window.start, window.end);
}

function isInAnyQuietWindow(windows: QuietWindow[], timezone: string): boolean {
  return windows.some((w) => isInQuietWindow(w, timezone));
}

function buildPushPayload(input: SendNotificationInput, deepLink: string, logId: string | null) {
  return JSON.stringify({
    title: input.title,
    body: input.body,
    data: {
      route: deepLink,
      params: JSON.stringify(input.params),
      notificationType: input.type,
      subjectUri: input.subjectUri || '',
      notificationId: logId || '',
      imageUrl: input.imageUrl || '',
    },
    tag: input.type,
    requireInteraction: input.priority === 'high',
  });
}

export async function dispatchNotification(
  svc: any,
  input: SendNotificationInput
): Promise<{ delivered: boolean; deepLink: string; reason?: string; logId?: string }> {
  const deepLink = buildDeepLink(input.type, input.params);

  // 0. Enforce the recipient's notification preferences (who can reach them,
  //    on-site-only, master pause). actorDid is optional — system-generated
  //    notifications (price alerts, achievements) have no actor, so only the
  //    master pause applies to them.
  try {
    const filter = await shouldDeliverNotification(svc, {
      recipientDid: input.recipientDid,
      actorDid: input.actorDid,
    });
    if (!filter.allowed) {
      return { delivered: false, deepLink, reason: `filtered:${filter.reason}` };
    }
  } catch (e) {
    console.error('dispatchNotification: pref filter failed', e?.message || e);
    // Fail open — don't silently mute on a filter error.
  }

  // 1. Check preferences from SettingsConfig
  let pushEnabled = true;
  let eventEnabled = true;
  let quietWindows: { start: string; end: string; days?: number[]; mode?: string }[] = [];
  let timezone = 'UTC';

  try {
    const prefs = await svc.entities.SettingsConfig.filter({ did: input.recipientDid }, '-updated_date', 1);
    const config = prefs[0]?.config || {};
    const n = config.notifications || {};
    const eventTypes = n.eventTypes || {};
    if (eventTypes[input.type] === false) eventEnabled = false;
    const channels = n.channels || ['push'];
    pushEnabled = channels.includes('push');
    const qh = n.quietHours || {};
    timezone = config.locale?.timezone || 'UTC';
    quietWindows = Array.isArray(qh.windows)
      ? qh.windows
      : (qh.start && qh.end ? [{ start: qh.start, end: qh.end, days: [], mode: 'hold' }] : []);
  } catch {}

  if (!eventEnabled) return { delivered: false, deepLink, reason: 'event_disabled' };

  // 2. Quiet hours (skip for high priority)
  let channel: 'push' | 'in_app' = 'push';
  if (pushEnabled && quietWindows.length > 0 && input.priority !== 'high') {
    if (isInAnyQuietWindow(quietWindows, timezone)) channel = 'in_app';
  }
  if (!pushEnabled) channel = 'in_app';

  // 3. Create notification log
  let logId: string | null = null;
  try {
    const log = await svc.entities.NotificationLog.create({
      did: input.recipientDid,
      notification_type: input.type,
      title: input.title,
      body: input.body,
      data: { ...input.params, subjectUri: input.subjectUri || '' },
      deep_link: deepLink,
      status: 'pending',
    });
    logId = log.id;
  } catch (e) {
    console.error('Failed to create notification log', e?.message || e);
  }

  // 4. Rate limit check
  if (channel === 'push') {
    try {
      const todayStart = new Date();
      todayStart.setUTCHours(0, 0, 0, 0);
      const recent = await svc.entities.NotificationLog.filter(
        { did: input.recipientDid },
        '-created_date',
        200
      );
      const todayCount = recent.filter((l: any) => new Date(l.created_date) >= todayStart).length;
      if (todayCount >= MAX_DAILY_PUSHES) channel = 'in_app';
    } catch {}
  }

  // 5. In-app only — mark delivered (in-app Notification created client-side)
  if (channel === 'in_app') {
    if (logId) {
      try {
        await svc.entities.NotificationLog.update(logId, {
          status: 'delivered',
          delivered_at: new Date().toISOString(),
        });
      } catch {}
    }
    return { delivered: false, deepLink, reason: 'in_app_only', logId: logId || undefined };
  }

  // 6. Send push
  const publicKey = Deno.env.get('VAPID_PUBLIC_KEY');
  const privateKey = Deno.env.get('VAPID_PRIVATE_KEY');
  if (!publicKey || !privateKey) {
    if (logId) await svc.entities.NotificationLog.update(logId, { status: 'failed', failure_reason: 'VAPID not configured' }).catch(() => {});
    return { delivered: false, deepLink, reason: 'vapid_missing', logId: logId || undefined };
  }

  try {
    webPush.setVapidDetails('mailto:support@swappulse.org', publicKey, privateKey);
  } catch (e: any) {
    if (logId) await svc.entities.NotificationLog.update(logId, { status: 'failed', failure_reason: 'VAPID setup failed' }).catch(() => {});
    return { delivered: false, deepLink, reason: 'vapid_error', logId: logId || undefined };
  }

  const payload = buildPushPayload(input, deepLink, logId);

  // Collect all subscriptions: PushToken records + legacy User.push_subscription
  const subscriptions: { json: string; tokenId?: string }[] = [];
  try {
    const tokens = await svc.entities.PushToken.filter(
      { did: input.recipientDid, is_active: true },
      '-created_date',
      20
    );
    for (const t of tokens) {
      if (t.subscription) subscriptions.push({ json: t.subscription, tokenId: t.id });
    }
  } catch {}

  // Legacy fallback
  if (subscriptions.length === 0) {
    try {
      const users = await svc.entities.User.filter({ did: input.recipientDid }, '-created_date', 1);
      const legacy = users[0]?.push_subscription;
      if (legacy) subscriptions.push({ json: legacy });
    } catch {}
  }

  if (subscriptions.length === 0) {
    if (logId) await svc.entities.NotificationLog.update(logId, { status: 'failed', failure_reason: 'no push tokens' }).catch(() => {});
    return { delivered: false, deepLink, reason: 'no_tokens', logId: logId || undefined };
  }

  let anyDelivered = false;
  let lastError = '';
  for (const sub of subscriptions) {
    try {
      await webPush.sendNotification(JSON.parse(sub.json), payload);
      anyDelivered = true;
      if (sub.tokenId) {
        try { await svc.entities.PushToken.update(sub.tokenId, { last_used_at: new Date().toISOString() }); } catch {}
      }
    } catch (e: any) {
      lastError = e?.message || 'push failed';
      const status = e?.statusCode || e?.status;
      if ((status === 410 || status === 404) && sub.tokenId) {
        try { await svc.entities.PushToken.update(sub.tokenId, { is_active: false }); } catch {}
      }
    }
  }

  if (anyDelivered) {
    if (logId) await svc.entities.NotificationLog.update(logId, { status: 'delivered', delivered_at: new Date().toISOString() }).catch(() => {});
    return { delivered: true, deepLink, logId: logId || undefined };
  }

  if (logId) await svc.entities.NotificationLog.update(logId, { status: 'failed', failure_reason: lastError }).catch(() => {});
  return { delivered: false, deepLink, reason: 'push_failed', logId: logId || undefined };
}