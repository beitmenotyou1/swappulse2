import { useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useBanner } from './BannerProvider';

// Subscribes to the Notification entity realtime stream for the current user
// and surfaces a bottom-right popup for each new record while the app is open.
// This complements NotificationHandler (which only fires for push-delivered
// notifications via the service worker). Dedup is handled centrally in
// BannerProvider by data.notificationId, so a notification delivered via both
// push and realtime only shows once.
function notificationToBanner(n) {
  const actor = n.actor_name || 'Someone';
  let title = '';
  let body = '';
  switch (n.action_type) {
    case 'like': title = `${actor} liked your post`; break;
    case 'repost': title = `${actor} reposted your post`; break;
    case 'quote': title = `${actor} quoted your post`; body = n.metadata?.quoteText || ''; break;
    case 'comment': title = `${actor} commented on your post`; body = n.metadata?.commentText || ''; break;
    case 'follow': title = `${actor} followed you`; break;
    case 'mention': title = `${actor} mentioned you`; break;
    case 'trade_match': title = 'Wishlist match!'; body = `${actor} listed a card on your wishlist.`; break;
    case 'reaction': title = `${actor} reacted to your post`; body = n.metadata?.reactionType || ''; break;
    case 'price_alert': title = 'Price drop alert'; body = n.target_label || 'A wishlisted card dropped in price.'; break;
    case 'voice_live': title = `${actor} went live`; break;
    case 'podcast': title = `${actor} published a new podcast`; break;
    case 'message': title = `${actor} sent you a message`; body = n.target_label || ''; break;
    case 'reputation': title = n.target_label || 'Your reputation was updated'; break;
    case 'pack_pull': title = `${actor} pulled a card on your wishlist`; break;
    default: title = `${actor} notified you`;
  }
  return {
    title,
    body,
    data: {
      notificationType: n.action_type,
      route: n.target_path || '/notifications',
      notificationId: n.id,
    },
  };
}

// Renders nothing — surfaces Notification entity creates as popups.
export default function NotificationPopupListener() {
  const { user } = useAuth();
  const did = user?.did;
  const { showBanner } = useBanner();
  const didRef = useRef(did);
  didRef.current = did;

  useEffect(() => {
    if (!did) return;
    let unsub;
    try {
      unsub = base44.entities.Notification.subscribe((event) => {
        if (event.type !== 'create') return;
        const n = event.data;
        if (!n || n.did !== didRef.current) return;
        showBanner(notificationToBanner(n));
      });
    } catch {}
    return () => { if (unsub) unsub(); };
  }, [did, showBanner]);

  return null;
}