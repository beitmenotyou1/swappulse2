import React from 'react';
import HelpArticle from '@/components/help/HelpArticle';
import HelpContentRenderer from '@/components/help/HelpContentRenderer';
import { useHelpContent } from '@/hooks/useHelpContent';

export default function HelpHashtags() {
  const content = useHelpContent('hashtags');
  if (!content) return null;
  return (
    <HelpArticle title={content.title} subtitle={content.subtitle} slug="hashtags">
      <HelpContentRenderer content={content} />
    </HelpArticle>
  );
}