import React from 'react';
import HelpArticle from '@/components/help/HelpArticle';
import HelpContentRenderer from '@/components/help/HelpContentRenderer';
import { useHelpContent } from '@/hooks/useHelpContent';

export default function HelpModeration() {
  const content = useHelpContent('moderation');
  if (!content) return null;
  return (
    <HelpArticle title={content.title} subtitle={content.subtitle} slug="moderation">
      <HelpContentRenderer content={content} />
    </HelpArticle>
  );
}