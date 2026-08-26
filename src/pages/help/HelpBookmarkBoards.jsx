import React from 'react';
import HelpArticle from '@/components/help/HelpArticle';
import HelpContentRenderer from '@/components/help/HelpContentRenderer';
import { useHelpContent } from '@/hooks/useHelpContent';

export default function HelpBookmarkBoards() {
  const content = useHelpContent('bookmark-boards');
  if (!content) return null;
  return (
    <HelpArticle title={content.title} subtitle={content.subtitle} slug="bookmark-boards">
      <HelpContentRenderer content={content} />
    </HelpArticle>
  );
}