import React, { useRef } from 'react';
import { Image as ImageIcon, Video, X, Loader2 } from 'lucide-react';
import { useT } from '@/lib/i18n/I18nProvider';
import { detectVideoPlatform } from '@/lib/mediaEmbed';

// Media attachment UI for the composer: image picker (max 4 with alt text),
// video URL field with alt text, and link preview card. State is managed by
// the useMediaComposer hook; this component renders the controls and previews.
export default function MediaComposer({ media, content }) {
  const t = useT();
  const fileInputRef = useRef(null);

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files || []);
    files.slice(0, media.maxImages - media.images.length).forEach(media.addImage);
    e.target.value = '';
  };

  const detectedVideo = media.videoUrl.trim() ? detectVideoPlatform(media.videoUrl.trim()) : null;

  return (
    <div className="mt-2 space-y-3">
      {/* Image picker + previews */}
      {media.images.length > 0 && (
        <div className="space-y-2">
          {media.images.map((img, i) => (
            <div key={i} className="flex gap-2 rounded-lg border border-border bg-secondary p-2">
              <img
                src={img.previewUrl}
                alt={img.alt || ''}
                className="h-16 w-16 shrink-0 rounded-md object-cover"
              />
              <div className="flex-1">
                <input
                  type="text"
                  value={img.alt}
                  onChange={(e) => media.setImageAlt(i, e.target.value.slice(0, 500))}
                  placeholder={t('compose.imageAltPlaceholder')}
                  className="w-full rounded-md border border-border bg-background px-2 py-1 text-xs placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                />
                <button
                  onClick={() => media.removeImage(i)}
                  className="mt-1 flex items-center gap-1 text-xs text-destructive hover:underline"
                >
                  <X className="h-3 w-3" /> {t('compose.removeImage')}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Video URL field */}
      {media.videoUrl.trim() ? (
        <div className="rounded-lg border border-border bg-secondary p-2">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs font-medium text-primary">
              <Video className="h-3.5 w-3.5" />
              {detectedVideo ? `${t('compose.videoDetected')}: ${detectedVideo.platform}` : t('compose.video')}
            </span>
            <button aria-label="Remove video" onClick={media.removeVideo} className="text-destructive hover:underline">
              <X className="h-4 w-4" />
            </button>
          </div>
          <input
            type="url"
            value={media.videoUrl}
            onChange={(e) => media.setVideoUrl(e.target.value)}
            placeholder={t('compose.videoUrlPlaceholder')}
            className="mt-1.5 w-full rounded-md border border-border bg-background px-2 py-1 text-xs placeholder:text-muted-foreground focus:border-primary focus:outline-none"
          />
          <input
            type="text"
            value={media.videoAlt}
            onChange={(e) => media.setVideoAlt(e.target.value.slice(0, 500))}
            placeholder={t('compose.imageAltPlaceholder')}
            className="mt-1.5 w-full rounded-md border border-border bg-background px-2 py-1 text-xs placeholder:text-muted-foreground focus:border-primary focus:outline-none"
          />
        </div>
      ) : null}

      {/* Link preview card */}
      {media.fetchingPreview && (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-secondary p-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> {t('compose.fetchingPreview')}
        </div>
      )}
      {media.linkPreview && !media.fetchingPreview && (
        <div className="flex gap-2 overflow-hidden rounded-lg border border-border bg-secondary p-2">
          {media.linkPreview.thumb && (
            <img
              src={media.linkPreview.thumb}
              alt={media.linkPreview.title || 'Link preview'}
              className="h-14 w-20 shrink-0 rounded-md object-cover"
            />
          )}
          <div className="flex-1 min-w-0">
            <p className="truncate text-xs font-semibold">{media.linkPreview.title}</p>
            <p className="line-clamp-1 text-xs text-muted-foreground">{media.linkPreview.description}</p>
            <div className="mt-0.5 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{media.linkPreview.site_name}</span>
              <button aria-label="Remove link preview"
                onClick={() => media.setLinkPreview(null)}
                className="text-destructive hover:underline"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex items-center gap-1">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileSelect}
          className="hidden"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={media.images.length >= media.maxImages}
          className="flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs text-primary transition-colors hover:bg-primary/10 disabled:opacity-40 sm:px-3 sm:text-sm"
          title={media.images.length >= media.maxImages ? t('compose.maxImages') : t('compose.addImages')}
        >
          <ImageIcon className="h-4 w-4" /> {t('compose.images')}
        </button>
        {!media.videoUrl.trim() && (
          <button
            onClick={() => {
              const url = prompt(t('compose.videoUrlPlaceholder'));
              if (url) media.setVideoUrl(url);
            }}
            className="flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs text-primary transition-colors hover:bg-primary/10 sm:px-3 sm:text-sm"
          >
            <Video className="h-4 w-4" /> {t('compose.video')}
          </button>
        )}
      </div>
    </div>
  );
}