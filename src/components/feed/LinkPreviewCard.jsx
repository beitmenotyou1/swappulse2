import React from 'react';
import { ExternalLink } from 'lucide-react';
import { Image } from '@/components/ui/image';
import { confirmExternalLink, getSafeHttpUrl } from '@/lib/externalLink';

// Large OpenGraph preview card for non-embeddable URLs.
// Shows thumbnail, title, description, and domain. Opens externally via
// the shared confirmation dialog.
export default function LinkPreviewCard({ ext }) {
  if (!ext?.uri) return null;
  const safeUri = getSafeHttpUrl(ext.uri);
  if (!safeUri) return null;

  const domain = (() => {
    try { return new URL(safeUri).hostname.replace(/^www\./, ''); }
    catch { return ext.site_name || ''; }
  })();

  const handleClick = (e) => {
    e.preventDefault();
    confirmExternalLink(safeUri);
  };

  return (
    <a
      href={safeUri}
      onClick={handleClick}
      className="mt-3 flex overflow-hidden rounded-xl border border-border bg-secondary transition-colors hover:bg-secondary/80"
    >
      {ext.thumb && (
        <Image
          src={ext.thumb}
          alt={ext.title || 'Link preview'}
          className="h-28 w-40 shrink-0 object-cover sm:h-32 sm:w-48"
          fittingType="cover"
        />
      )}
      <div className="flex min-w-0 flex-col justify-center px-4 py-3">
        <p className="truncate text-sm font-semibold">{ext.title || ext.uri}</p>
        {ext.description && (
          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{ext.description}</p>
        )}
        <span className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground">
          <ExternalLink className="h-3 w-3" />
          {ext.site_name || domain}
        </span>
      </div>
    </a>
  );
}