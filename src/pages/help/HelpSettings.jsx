import React from 'react';
import HelpArticle from '@/components/help/HelpArticle';
import HelpContentRenderer from '@/components/help/HelpContentRenderer';
import { useHelpContent } from '@/hooks/useHelpContent';

export default function HelpSettings() {
  const content = useHelpContent('settings');
  if (!content) return null;
  return (
    <HelpArticle title={content.title} subtitle={content.subtitle} slug="settings">
      <HelpContentRenderer content={content} />
    </HelpArticle>
  );
}