import React from 'react';
import { Image } from '@/components/ui/image';
import { normaliseImages } from '@/lib/mediaEmbed';

// X/Bluesky-style image gallery for 1–4 images.
// Layout: 1 = full-width, 2 = side-by-side, 3 = 2-over-1, 4 = 2×2 grid.
// Each image shows alt text as a tooltip on hover (title attribute).
export default function MediaGallery({ images }) {
  const imgs = normaliseImages(images);
  if (imgs.length === 0) return null;

  const count = imgs.length;
  const gridClass =
    count === 1 ? 'grid-cols-1' :
    count === 2 ? 'grid-cols-2' :
    count === 3 ? 'grid-cols-2' :
    'grid-cols-2';

  // For 3 images: first image spans 2 rows, other two stack on the right
  const rowSpanClass = (i) => {
    if (count === 3 && i === 0) return 'row-span-2';
    return '';
  };

  return (
    <div data-lightbox className={`mt-3 grid gap-1 overflow-hidden rounded-xl border border-border ${gridClass}`}>
      {imgs.map((img, i) => (
        <div
          key={i}
          className={`relative overflow-hidden ${rowSpanClass(i)} ${
            count === 1 ? 'aspect-video' : count === 3 && i === 0 ? 'h-full min-h-48' : 'aspect-square'
          }`}
        >
          <Image
            src={img.url}
            alt={img.alt || 'Post image'}
            title={img.alt || ''}
            className="h-full w-full object-cover"
            fittingType="cover"
          />
        </div>
      ))}
    </div>
  );
}