import React from 'react';
import HelpArticle from '@/components/help/HelpArticle';
import HelpContentRenderer from '@/components/help/HelpContentRenderer';
import { useHelpContent } from '@/hooks/useHelpContent';

export default function HelpTradeThread() {
  const content = useHelpContent('trade-threads');
  if (!content) return null;
  return (
    <HelpArticle title={content.title} subtitle={content.subtitle} slug="trade-threads">
      <HelpContentRenderer content={content} />
    </HelpArticle>
  );
}
