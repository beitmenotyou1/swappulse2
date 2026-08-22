import React from 'react';
import MediaGallery from '@/components/feed/MediaGallery';
import VideoEmbed from '@/components/feed/VideoEmbed';
import LinkPreviewCard from '@/components/feed/LinkPreviewCard';
import NativeVideoPlayer from '@/components/feed/NativeVideoPlayer';

// Renders all media embeds for a post: image gallery, inline video player,
// and OpenGraph link preview card. Shown between the text body and the
// card/quote attachments. Handles both locally-composed and Bluesky-bridged
// posts since both populate the same embed_images/embed_video/embed_external
// fields. Native uploaded videos (platform 'other') use the inline player;
// external platform links (YouTube/TikTok/etc.) use VideoEmbed.
export default function PostEmbeds({ post }) {
  const images = Array.isArray(post.embed_images) ? post.embed_images : [];
  const video = post.embed_video;
  const ext = post.embed_external;
  const isNativeVideo = video?.url && (!video.platform || video.platform === 'other');

  return (
    <>
      {images.length > 0 && <MediaGallery images={images} />}
      {video?.url && isNativeVideo && <NativeVideoPlayer url={video.url} altText={video.alt_text} />}
      {video?.url && !isNativeVideo && <VideoEmbed video={video} />}
      {ext?.uri && <LinkPreviewCard ext={ext} />}
    </>
  );
}