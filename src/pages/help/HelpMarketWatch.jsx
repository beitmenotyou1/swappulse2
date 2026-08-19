import React from 'react';
import HelpArticle from '@/components/help/HelpArticle';
import HelpContentRenderer from '@/components/help/HelpContentRenderer';
import { useHelpContent } from '@/hooks/useHelpContent';

export default function HelpMarketWatch() {
  const content = useHelpContent('market-watch');
  if (!content) return null;
  return (
    <HelpArticle title={content.title} subtitle={content.subtitle} slug="market-watch">
      <HelpContentRenderer content={content} />
    </HelpArticle>
  );
}