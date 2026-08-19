import React from 'react';
import HelpArticle from '@/components/help/HelpArticle';
import HelpContentRenderer from '@/components/help/HelpContentRenderer';
import { useHelpContent } from '@/hooks/useHelpContent';

export default function HelpCollectionAdvisor() {
  const content = useHelpContent('collection-advisor');
  if (!content) return null;
  return (
    <HelpArticle title={content.title} subtitle={content.subtitle} slug="collection-advisor">
      <HelpContentRenderer content={content} />
    </HelpArticle>
  );
}