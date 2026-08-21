import React from 'react';
import { ExternalLink } from 'lucide-react';
import { Image } from '@/components/ui/image';

// Renders Bluesky media embeds (images + external link cards) that were
// extracted from the post's embed block by the backfill/ingest mapper.
// Shown between the text body and the card/quote attachments.
export default function PostEmbeds({ post }) {
  const images = Array.isArray(post.embed_images) ? post.embed_images.filter(Boolean) : [];
  const ext = post.embed_external;

  return (
    <>
      {images.length > 0 && (
        <div className={`mt-3 grid gap-1 overflow-hidden rounded-xl border border-border ${images.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
          {images.map((url, i) => (
            <Image
              key={i}
              src={url}
              alt={post.content?.slice(0, 100) || 'Post image'}
              className={`w-full object-cover ${images.length === 1 ? 'max-h-96' : 'h-48'}`}
              fittingType="cover"
            />
          ))}
        </div>
      )}

      {ext?.uri && (
        <a
          href={ext.uri}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 flex overflow-hidden rounded-xl border border-border bg-secondary transition-colors hover:bg-secondary/80"
        >
          {ext.thumb && (
            <Image
              src={ext.thumb}
              alt={ext.title || 'Link preview'}
              className="h-20 w-28 shrink-0 object-cover"
              fittingType="cover"
            />
          )}
          <div className="flex min-w-0 flex-col justify-center px-3 py-2">
            <p className="truncate text-sm font-semibold">{ext.title || ext.uri}</p>
            {ext.description && (
              <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{ext.description}</p>
            )}
            <span className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
              <ExternalLink className="h-3 w-3" />
              {new URL(ext.uri).hostname.replace(/^www\./, '')}
            </span>
          </div>
        </a>
      )}
    </>
  );
}