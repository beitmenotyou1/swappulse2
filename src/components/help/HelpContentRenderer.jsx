import React from 'react';
import { HelpSection, HelpSteps, HelpList } from '@/components/help/HelpArticle';
import { getIcon } from '@/lib/helpIcons';

// Renders structured help content (from helpContent.js or translated JSON)
// using the existing HelpSection / HelpSteps / HelpList components.
export default function HelpContentRenderer({ content }) {
  if (!content || !content.sections) return null;
  return (
    <>
      {content.sections.map((section, i) => {
        const Icon = getIcon(section.icon);
        return (
          <HelpSection
            key={i}
            icon={Icon}
            title={section.title}
            variant={section.variant}
          >
            {(section.blocks || []).map((block, j) => {
              if (block.type === 'p') {
                return <p key={j}>{block.text}</p>;
              }
              if (block.type === 'steps') {
                return (
                  <HelpSteps key={j}>
                    {(block.items || []).map((item, k) => (
                      <li key={k}>{renderRichText(item)}</li>
                    ))}
                  </HelpSteps>
                );
              }
              if (block.type === 'list') {
                return (
                  <HelpList key={j}>
                    {(block.items || []).map((item, k) => (
                      <li key={k}>{renderRichText(item)}</li>
                    ))}
                  </HelpList>
                );
              }
              return null;
            })}
          </HelpSection>
        );
      })}
    </>
  );
}

// Renders text with inline <b>...</b> tags as bold React elements.
function renderRichText(text) {
  if (typeof text !== 'string') return text;
  const parts = text.split(/(<b>.*?<\/b>)/g);
  return parts.map((part, i) => {
    if (part.startsWith('<b>') && part.endsWith('</b>')) {
      return <b key={i}>{part.slice(3, -4)}</b>;
    }
    return part;
  });
}