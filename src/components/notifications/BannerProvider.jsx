import React, { createContext, useContext, useState, useCallback } from 'react';
import InAppBanner from './InAppBanner';

const BannerContext = createContext({ showBanner: () => {} });

export const useBanner = () => useContext(BannerContext);

export default function BannerProvider({ children }) {
  const [banners, setBanners] = useState([]);

  const showBanner = useCallback((notification) => {
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
        <div className="fixed top-3 left-1/2 z-[100] w-full max-w-md -translate-x-1/2 space-y-2 px-3">
          {banners.map((banner) => (
            <InAppBanner key={banner.id} notification={banner} onDismiss={dismissBanner} />
          ))}
        </div>
      )}
    </BannerContext.Provider>
  );
}