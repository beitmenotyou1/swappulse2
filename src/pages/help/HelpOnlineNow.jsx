import React from 'react';
import HelpArticle from '@/components/help/HelpArticle';
import HelpContentRenderer from '@/components/help/HelpContentRenderer';
import { useHelpContent } from '@/hooks/useHelpContent';

export default function HelpOnlineNow() {
  const content = useHelpContent('online-now');
  if (!content) return null;
  return (
    <HelpArticle title={content.title} subtitle={content.subtitle} slug="online-now">
      <HelpContentRenderer content={content} />
    </HelpArticle>
  );
}