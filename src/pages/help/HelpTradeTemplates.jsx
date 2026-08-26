import React from 'react';
import HelpArticle from '@/components/help/HelpArticle';
import HelpContentRenderer from '@/components/help/HelpContentRenderer';
import { useHelpContent } from '@/hooks/useHelpContent';

export default function HelpTradeTemplates() {
  const content = useHelpContent('trade-templates');
  if (!content) return null;
  return (
    <HelpArticle title={content.title} subtitle={content.subtitle} slug="trade-templates">
      <HelpContentRenderer content={content} />
    </HelpArticle>
  );
}