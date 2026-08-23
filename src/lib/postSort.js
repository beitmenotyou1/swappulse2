// Sort posts by original_created_at (falling back to created_date), descending
// (most recent first). Used by all feed surfaces to ensure imported Bluesky
// posts appear in their original chronological order, not import order.
export function sortPostsDescending(posts) {
  return [...posts].sort((a, b) => {
    const aTime = new Date(a.original_created_at || a.created_date || 0).getTime();
    const bTime = new Date(b.original_created_at || b.created_date || 0).getTime();
    return bTime - aTime;
  });
}

// Sort posts by original_created_at (falling back to created_date), ascending
// (oldest first). Used by reply threads where the conversation reads top-to-bottom.
export function sortPostsAscending(posts) {
  return [...posts].sort((a, b) => {
    const aTime = new Date(a.original_created_at || a.created_date || 0).getTime();
    const bTime = new Date(b.original_created_at || b.created_date || 0).getTime();
    return aTime - bTime;
  });
}