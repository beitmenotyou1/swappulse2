import React from 'react';
import HelpArticle from '@/components/help/HelpArticle';
import HelpContentRenderer from '@/components/help/HelpContentRenderer';
import { useHelpContent } from '@/hooks/useHelpContent';

export default function HelpWhoToFollow() {
  const content = useHelpContent('who-to-follow');
  if (!content) return null;
  return (
    <HelpArticle title={content.title} subtitle={content.subtitle} slug="who-to-follow">
      <HelpContentRenderer content={content} />
    </HelpArticle>
  );
}
