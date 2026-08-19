import React from 'react';
import HelpArticle from '@/components/help/HelpArticle';
import HelpContentRenderer from '@/components/help/HelpContentRenderer';
import { useHelpContent } from '@/hooks/useHelpContent';

export default function HelpTradeDashboard() {
  const content = useHelpContent('trade-dashboard');
  if (!content) return null;
  return (
    <HelpArticle title={content.title} subtitle={content.subtitle} slug="trade-dashboard">
      <HelpContentRenderer content={content} />
    </HelpArticle>
  );
}