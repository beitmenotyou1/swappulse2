import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBanner } from './BannerProvider';
import { navigateFromDeepLink } from '@/lib/deepLinks';
import { base44 } from '@/api/base44Client';

// Listens for service worker messages (PUSH_RECEIVED for foreground banners,
// NAVIGATE for notification taps) and routes accordingly. Mount once in the
// Layout — it renders nothing.
export default function NotificationHandler() {
  const navigate = useNavigate();
  const { showBanner } = useBanner();

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    const handleMessage = (event) => {
      if (!event.data) return;

      // Foreground push → in-app banner
      if (event.data.type === 'PUSH_RECEIVED') {
        const { title, body, data } = event.data.payload || {};
        showBanner({ title, body, data });
        return;
      }

      // Notification tap → navigate
      if (event.data.type === 'NAVIGATE') {
        const { route, notificationId } = event.data;
        if (route) navigateFromDeepLink(navigate, route);
        if (notificationId) {
          base44.functions.invoke('mark-notification-opened', { notificationId }).catch(() => {});
        }
        return;
      }
    };

    navigator.serviceWorker.addEventListener('message', handleMessage);
    return () => navigator.serviceWorker.removeEventListener('message', handleMessage);
  }, [navigate, showBanner]);

  return null;
}