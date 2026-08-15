import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import InAppBanner from './InAppBanner';

const BannerContext = createContext({ showBanner: () => {} });

export const useBanner = () => useContext(BannerContext);

export default function BannerProvider({ children }) {
  const [banners, setBanners] = useState([]);
  // Track notification IDs already shown this session so a notification
  // delivered via both push (service worker) and realtime (Notification
  // entity subscription) only surfaces one popup.
  const shownIds = useRef(new Set());

  const showBanner = useCallback((notification) => {
    const notifId = notification?.data?.notificationId;
    if (notifId) {
      if (shownIds.current.has(notifId)) return;
      shownIds.current.add(notifId);
    }
    const id = notification.id || crypto.randomUUID();
    setBanners((prev) => [...prev, { ...notification, id }]);
  }, []);

  const dismissBanner = useCallback((id) => {
    setBanners((prev) => prev.filter((b) => b.id !== id));
  }, []);

  return (
    <BannerContext.Provider value={{ showBanner }}>
      {children}
      {banners.length > 0 && (
        // Bottom-right, offset above the mobile bottom nav and compose FAB.
        <div className="fixed bottom-20 right-4 z-[100] flex w-full max-w-[380px] flex-col gap-2 px-3 pb-2 md:bottom-6 md:right-6 md:px-0">
          {banners.map((banner) => (
            <InAppBanner key={banner.id} notification={banner} onDismiss={dismissBanner} />
          ))}
        </div>
      )}
    </BannerContext.Provider>
  );
}