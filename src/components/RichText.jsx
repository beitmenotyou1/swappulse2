import React from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink as ExternalLinkIcon } from 'lucide-react';
import { confirmExternalLink, isExternalUrl } from '@/lib/externalLink';

// Shared text renderer that turns #hashtags and http(s) URLs in plain text
// into clickable elements. Hashtags link to /hashtag/:tag (internal, no
// confirmation). External URLs open via the shared confirmation dialog in a
// new tab. Used by PostCard, PostDetail, CommentItem, and profile bios.
//
// The hashtag regex matches the same pattern used by ComposeBox extraction
// (# followed by unicode letters/numbers/underscore) so display and stored
// canonical_tags stay consistent.

const HASHTAG_OR_URL = /(#(?:[\p{L}\p{N}_]+))|(https?:\/\/[^\s]+)/gu;

export default function RichText({ text, className = '', as: Tag = 'p' }) {
  if (!text) return <Tag className={className} />;

  const parts = [];
  let lastIndex = 0;
  let match;
  let key = 0;

  HASHTAG_OR_URL.lastIndex = 0;
  while ((match = HASHTAG_OR_URL.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const [full, tag] = match;
    if (tag) {
      // Hashtag — internal link, no confirmation
      const canonical = tag.slice(1).toLowerCase();
      parts.push(
        <Link
          key={`h-${key}`}
          to={`/hashtag/${canonical}`}
          className="font-medium text-primary hover:underline"
        >
          {full}
        </Link>
      );
    } else {
      // URL — external link with confirmation
      const href = full;
      const external = isExternalUrl(href);
      parts.push(
        <a
          key={`u-${key}`}
          href={external ? undefined : href}
          onClick={(e) => {
            if (!external) return; // let internal links navigate normally
            e.preventDefault();
            confirmExternalLink(href);
          }}
          className="inline-flex items-center gap-0.5 font-medium text-primary hover:underline"
        >
          {full}
          {external && <ExternalLinkIcon className="h-3 w-3 shrink-0" />}
        </a>
      );
    }
    lastIndex = HASHTAG_OR_URL.lastIndex;
    key++;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return <Tag className={className}>{parts}</Tag>;
}