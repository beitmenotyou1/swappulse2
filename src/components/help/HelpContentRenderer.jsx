import React from 'react';
import { HelpSection, HelpSteps, HelpList } from '@/components/help/HelpArticle';
import { getHelpIcon } from '@/lib/helpIcons';

// Renders structured help-page content (from src/lib/helpContent.js) using the
// shared HelpSection / HelpSteps / HelpList components. Supports <b>...</b>
// inline bold tags in text. Used by all refactored help pages so that
// translated content (from TranslationOverride) can be rendered without
// changing the page component.

function renderInline(text) {
  if (!text) return null;
  // Split on <b>...</b> tags and render bold segments
  const parts = [];
  const regex = /<b>(.*?)<\/b>/g;
  let lastIndex = 0;
  let match;
  let key = 0;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    parts.push(<b key={key++}>{match[1]}</b>);
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return parts.length === 1 ? parts[0] : parts;
}

function renderBlock(block) {
  if (block.type === 'p') {
    return <p>{renderInline(block.text)}</p>;
  }
  if (block.type === 'steps') {
    return <HelpSteps>{block.items.map((item, i) => <li key={i}>{renderInline(item)}</li>)}</HelpSteps>;
  }
  if (block.type === 'list') {
    return <HelpList>{block.items.map((item, i) => <li key={i}>{renderInline(item)}</li>)}</HelpList>;
  }
  return null;
}

export default function HelpContentRenderer({ content }) {
  if (!content || !content.sections) return null;
  return (
    <>
      {content.sections.map((section, i) => {
        const Icon = section.icon ? getHelpIcon(section.icon) : null;
        return (
          <HelpSection key={i} icon={Icon} title={section.title} variant={section.variant}>
            {(section.blocks || []).map((block, j) => (
              <React.Fragment key={j}>{renderBlock(block)}</React.Fragment>
            ))}
          </HelpSection>
        );
      })}
    </>
  );
}