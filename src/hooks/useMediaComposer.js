import { useState, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { detectVideoPlatform, findPreviewableUrl } from '@/lib/mediaEmbed';

// Manages all media attachment state for the post composer:
// - Up to 4 images (each with alt text), stored as object URLs before upload
// - One external video URL (with alt text), classified by platform
// - One link preview card (auto-fetched from the first non-video URL in the text)
//
// On submit, buildMediaFields() uploads pending images via UploadFile and
// returns { embed_images, embed_video, embed_external } ready for Post.create.
// reset() clears all state after a successful post.

const MAX_IMAGES = 4;

export function useMediaComposer() {
  // Images: [{ file, previewUrl, alt }] — previewUrl is a local object URL
  const [images, setImages] = useState([]);
  const [videoUrl, setVideoUrl] = useState('');
  const [videoAlt, setVideoAlt] = useState('');
  const [linkPreview, setLinkPreview] = useState(null);
  const [fetchingPreview, setFetchingPreview] = useState(false);
  const lastPreviewUrl = useRef('');

  const addImage = useCallback((file) => {
    setImages((prev) => {
      if (prev.length >= MAX_IMAGES) return prev;
      return [...prev, { file, previewUrl: URL.createObjectURL(file), alt: '' }];
    });
  }, []);

  const removeImage = useCallback((index) => {
    setImages((prev) => {
      const next = [...prev];
      URL.revokeObjectURL(next[index]?.previewUrl || '');
      next.splice(index, 1);
      return next;
    });
  }, []);

  const setImageAlt = useCallback((index, alt) => {
    setImages((prev) => {
      const next = [...prev];
      if (next[index]) next[index] = { ...next[index], alt };
      return next;
    });
  }, []);

  const removeVideo = useCallback(() => {
    setVideoUrl('');
    setVideoAlt('');
  }, []);

  // Detect and fetch a link preview for the first non-video URL in the text.
  // Called on text change. Skips if the URL hasn't changed or is a video URL.
  const detectLinkPreview = useCallback(async (text) => {
    const previewable = findPreviewableUrl(text, videoUrl);
    if (!previewable) {
      setLinkPreview(null);
      lastPreviewUrl.current = '';
      return;
    }
    if (previewable === lastPreviewUrl.current && linkPreview) return;
    lastPreviewUrl.current = previewable;
    setFetchingPreview(true);
    try {
      const res = await base44.functions.invoke('fetch-link-preview', { url: previewable });
      if (res?.title || res?.description || res?.image) {
        setLinkPreview({
          uri: res.url || previewable,
          title: res.title || '',
          description: res.description || '',
          thumb: res.image || '',
          site_name: res.site_name || '',
        });
      } else {
        setLinkPreview(null);
      }
    } catch {
      setLinkPreview(null);
    } finally {
      setFetchingPreview(false);
    }
  }, [videoUrl, linkPreview]);

  // Upload all pending images and build the media fields for Post.create.
  // Returns { embed_images, embed_video, embed_external }.
  const buildMediaFields = useCallback(async () => {
    let embedImages = [];
    if (images.length > 0) {
      const uploaded = await Promise.all(
        images.map(async (img) => {
          const { file_url } = await base44.integrations.Core.UploadFile({ file: img.file });
          return { url: file_url, alt: img.alt || '' };
        })
      );
      embedImages = uploaded.filter((im) => im.url);
    }

    let embedVideo = null;
    if (videoUrl.trim()) {
      const detected = detectVideoPlatform(videoUrl.trim());
      embedVideo = {
        url: videoUrl.trim(),
        alt_text: videoAlt.trim(),
        platform: detected?.platform || 'other',
        thumbnail: detected?.thumbnail || '',
      };
    }

    return {
      embed_images: embedImages.length > 0 ? embedImages : undefined,
      embed_video: embedVideo || undefined,
      embed_external: linkPreview || undefined,
    };
  }, [images, videoUrl, videoAlt, linkPreview]);

  const reset = useCallback(() => {
    images.forEach((img) => URL.revokeObjectURL(img.previewUrl));
    setImages([]);
    setVideoUrl('');
    setVideoAlt('');
    setLinkPreview(null);
    lastPreviewUrl.current = '';
  }, [images]);

  return {
    images,
    videoUrl,
    videoAlt,
    linkPreview,
    fetchingPreview,
    maxImages: MAX_IMAGES,
    addImage,
    removeImage,
    setImageAlt,
    setVideoUrl,
    setVideoAlt,
    removeVideo,
    setLinkPreview,
    detectLinkPreview,
    buildMediaFields,
    reset,
  };
}