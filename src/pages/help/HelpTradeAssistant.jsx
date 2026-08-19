import React from 'react';
import HelpArticle from '@/components/help/HelpArticle';
import HelpContentRenderer from '@/components/help/HelpContentRenderer';
import { useHelpContent } from '@/hooks/useHelpContent';

export default function HelpTradeAssistant() {
  const content = useHelpContent('trade-assistant');
  if (!content) return null;
  return (
    <HelpArticle title={content.title} subtitle={content.subtitle} slug="trade-assistant">
      <HelpContentRenderer content={content} />
    </HelpArticle>
  );
}
