import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import Lightbox from '@/components/lightbox/Lightbox';
import { isLightboxable, collectGallery, getFullSizeSrc } from '@/lib/lightboxUtils';

const LightboxContext = createContext(null);

export function useLightbox() {
  return useContext(LightboxContext);
}

// Mounts once at the app root. A document-level capture-phase click listener
// opens the lightbox for any eligible content image on the page. Images inside
// a [data-lightbox] container become a navigable gallery (so a post's 1–4
// images can be scrolled with arrows); standalone content images open as a
// single-image lightbox. stopPropagation prevents ancestor click handlers
// (e.g. PostCard's click-to-navigate) from firing when the lightbox opens.
export function LightboxProvider({ children }) {
  const [state, setState] = useState(null);

  const openLightbox = useCallback((images, index) => {
    if (!images || images.length === 0) return;
    setState({ images, index: Math.max(0, Math.min(index, images.length - 1)) });
  }, []);

  const close = useCallback(() => setState(null), []);
  const prev = useCallback(
    () => setState((s) => (s ? { ...s, index: (s.index - 1 + s.images.length) % s.images.length } : s)),
    []
  );
  const next = useCallback(
    () => setState((s) => (s ? { ...s, index: (s.index + 1) % s.images.length } : s)),
    []
  );

  useEffect(() => {
    const onClick = (e) => {
      const img = e.target.closest && e.target.closest('img');
      if (!img || !isLightboxable(img)) return;

      const group = img.closest('[data-lightbox]');
      let images;
      let index = 0;
      if (group) {
        const imgs = Array.from(group.querySelectorAll('img')).filter(isLightboxable);
        const idx = imgs.indexOf(img);
        if (idx === -1) {
          images = [{ src: getFullSizeSrc(img.currentSrc || img.src), alt: img.alt || '' }];
        } else {
          images = imgs.map((im) => ({ src: getFullSizeSrc(im.currentSrc || im.src), alt: im.alt || '' }));
          index = idx;
        }
      } else {
        images = [{ src: getFullSizeSrc(img.currentSrc || img.src), alt: img.alt || '' }];
      }

      e.stopPropagation();
      e.preventDefault();
      openLightbox(images, index);
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [openLightbox]);

  return (
    <LightboxContext.Provider value={{ openLightbox, close }}>
      {children}
      <Lightbox state={state} onClose={close} onPrev={prev} onNext={next} />
    </LightboxContext.Provider>
  );
}