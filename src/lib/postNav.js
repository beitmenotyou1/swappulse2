// Shared helpers for click-to-navigate on posts, comments, and replies.
// Since comments and replies are stored as Post records (with reply_to set),
// they share the same /post/:id detail page. These helpers let any card-style
// component become clickable to open the item's detail page without
// intercepting clicks on buttons, links, or other interactive children.

// Build the detail-page route for a post/comment/reply record.
// Returns null when there is no usable identifier.
export function getPostDetailPath(record) {
  if (!record) return null;
  if (record.id) return `/post/${record.id}`;
  if (record.at_uri) return `/post/at/${encodeURIComponent(record.at_uri)}`;
  return null;
}

// Returns true when the click originated inside an interactive element
// (link, button, input, etc.) so the container click handler should NOT
// navigate away — the child element handles its own action.
export function isInteractiveTarget(e) {
  return !!e.target.closest(
    'a, button, [role="button"], input, textarea, select, [contenteditable], [data-no-navigate]'
  );
}