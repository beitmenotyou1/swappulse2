import React from 'react';
import HelpArticle from '@/components/help/HelpArticle';
import HelpContentRenderer from '@/components/help/HelpContentRenderer';
import { useHelpContent } from '@/hooks/useHelpContent';

export default function HelpCardDetail() {
  const content = useHelpContent('card-detail');
  if (!content) return null;
  return (
    <HelpArticle title={content.title} subtitle={content.subtitle} slug="card-detail">
      <HelpContentRenderer content={content} />
    </HelpArticle>
  );
}
