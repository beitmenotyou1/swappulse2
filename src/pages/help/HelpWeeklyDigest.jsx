import React from 'react';
import HelpArticle from '@/components/help/HelpArticle';
import HelpContentRenderer from '@/components/help/HelpContentRenderer';
import { useHelpContent } from '@/hooks/useHelpContent';

export default function HelpWeeklyDigest() {
  const content = useHelpContent('weekly-digest');
  if (!content) return null;
  return (
    <HelpArticle title={content.title} subtitle={content.subtitle} slug="weekly-digest">
      <HelpContentRenderer content={content} />
    </HelpArticle>
  );
}