import React from 'react';
import MediaGallery from '@/components/feed/MediaGallery';
import VideoEmbed from '@/components/feed/VideoEmbed';
import LinkPreviewCard from '@/components/feed/LinkPreviewCard';

// Renders all media embeds for a post: image gallery, inline video player,
// and OpenGraph link preview card. Shown between the text body and the
// card/quote attachments. Handles both locally-composed and Bluesky-bridged
// posts since both populate the same embed_images/embed_video/embed_external
// fields.
export default function PostEmbeds({ post }) {
  const images = Array.isArray(post.embed_images) ? post.embed_images : [];
  const video = post.embed_video;
  const ext = post.embed_external;

  return (
    <>
      {images.length > 0 && <MediaGallery images={images} />}
      {video?.url && <VideoEmbed video={video} />}
      {ext?.uri && <LinkPreviewCard ext={ext} />}
    </>
  );
}