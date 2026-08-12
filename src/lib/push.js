// Web Push subscription client — §8.1 Push Notifications (VAPID).
// Extended with multi-device PushToken registration via register-push-token.
// Keeps backward-compatible exports used by NotificationToggle.
import { base44 } from '@/api/base44Client';

function urlB64ToUint8(b64) {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const bin = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

export async function isPushSupported() {
  return (
    typeof navigator !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

export async function getVapidPublicKey() {
  const res = await base44.functions.invoke('getVapidPublicKey', {});
  return res.data?.publicKey || '';
}

async function withTimeout(promise, ms, fallback) {
  return Promise.race([
    promise,
    new Promise((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

export async function getSubscriptionState() {
  if (!(await isPushSupported())) return { supported: false, subscribed: false };
  try {
    const reg = await withTimeout(navigator.serviceWorker.ready, 2000, null);
    if (!reg) return { supported: true, subscribed: false };
    const sub = await reg.pushManager.getSubscription();
    return { supported: true, subscribed: !!sub };
  } catch {
    return { supported: true, subscribed: false };
  }
}

export async function subscribePush() {
  if (!(await isPushSupported())) throw new Error('Push not supported on this device');
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') throw new Error('Notification permission denied');
  const publicKey = await getVapidPublicKey();
  if (!publicKey) throw new Error('Push not configured yet — ask your admin to add VAPID keys');
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlB64ToUint8(publicKey),
  });
  const subStr = JSON.stringify(sub);
  // Register with backend (multi-device PushToken + legacy User.push_subscription)
  try {
    await base44.functions.invoke('register-push-token', {
      action: 'register',
      subscription: subStr,
      platform: 'web',
    });
  } catch (e) {
    console.error('register-push-token failed', e?.message || e);
  }
  // Keep legacy updateMe for backward compat with sendPush/dispatchBellNotifications
  await base44.auth.updateMe({ push_subscription: subStr });
  return sub;
}

export async function unsubscribePush() {
  if (!(await isPushSupported())) return;
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  let endpoint = '';
  if (sub) {
    endpoint = sub.endpoint || '';
    await sub.unsubscribe();
  }
  // Unregister from backend (deactivate PushToken by endpoint)
  try {
    await base44.functions.invoke('register-push-token', {
      action: 'unregister',
      endpoint,
    });
  } catch (e) {
    console.error('unregister-push-token failed', e?.message || e);
  }
  // Clear legacy
  await base44.auth.updateMe({ push_subscription: '' });
}