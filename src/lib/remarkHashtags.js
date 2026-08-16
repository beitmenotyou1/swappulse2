// A remark plugin that transforms #hashtag patterns in markdown text nodes
// into internal /hashtag/:tag links. Used by JournalView so journal bodies
// support clickable hashtags without changing how tags are stored.
//
// Walks the mdast tree and splits text nodes containing #tags into
// text + link nodes. No external dependencies — a simple recursive walk.

const HASHTAG = /#([\p{L}\p{N}_]+)/gu;

function splitHashtags(text) {
  const parts = [];
  let lastIndex = 0;
  let match;
  HASHTAG.lastIndex = 0;
  while ((match = HASHTAG.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', value: text.slice(lastIndex, match.index) });
    }
    parts.push({
      type: 'link',
      url: `/hashtag/${match[1].toLowerCase()}`,
      children: [{ type: 'text', value: match[0] }],
    });
    lastIndex = HASHTAG.lastIndex;
  }
  if (parts.length === 0) return null;
  if (lastIndex < text.length) {
    parts.push({ type: 'text', value: text.slice(lastIndex) });
  }
  return parts;
}

function walk(node) {
  if (!node || !node.children) return;
  const newChildren = [];
  for (const child of node.children) {
    if (child.type === 'text' && typeof child.value === 'string' && child.value.includes('#')) {
      const parts = splitHashtags(child.value);
      if (parts) {
        newChildren.push(...parts);
        continue;
      }
    }
    walk(child);
    newChildren.push(child);
  }
  node.children = newChildren;
}

export function remarkHashtags() {
  return (tree) => walk(tree);
}