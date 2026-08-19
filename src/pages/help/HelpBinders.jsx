import React from 'react';
import HelpArticle from '@/components/help/HelpArticle';
import HelpContentRenderer from '@/components/help/HelpContentRenderer';
import { useHelpContent } from '@/hooks/useHelpContent';

export default function HelpBinders() {
  const content = useHelpContent('binders');
  if (!content) return null;
  return (
    <HelpArticle title={content.title} subtitle={content.subtitle} slug="binders">
      <HelpContentRenderer content={content} />
    </HelpArticle>
  );
}