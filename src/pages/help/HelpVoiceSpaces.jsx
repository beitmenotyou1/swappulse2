import React from 'react';
import HelpArticle from '@/components/help/HelpArticle';
import HelpContentRenderer from '@/components/help/HelpContentRenderer';
import { useHelpContent } from '@/hooks/useHelpContent';

export default function HelpVoiceSpaces() {
  const content = useHelpContent('voice-spaces');
  if (!content) return null;
  return (
    <HelpArticle title={content.title} subtitle={content.subtitle} slug="voice-spaces">
      <HelpContentRenderer content={content} />
    </HelpArticle>
  );
}
