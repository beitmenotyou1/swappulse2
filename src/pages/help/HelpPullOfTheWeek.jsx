import React from 'react';
import HelpArticle from '@/components/help/HelpArticle';
import HelpContentRenderer from '@/components/help/HelpContentRenderer';
import { useHelpContent } from '@/hooks/useHelpContent';

export default function HelpPullOfTheWeek() {
  const content = useHelpContent('pull-of-the-week');
  if (!content) return null;
  return (
    <HelpArticle title={content.title} subtitle={content.subtitle} slug="pull-of-the-week">
      <HelpContentRenderer content={content} />
    </HelpArticle>
  );
}