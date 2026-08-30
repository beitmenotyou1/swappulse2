import React from 'react';
import HelpArticle from '@/components/help/HelpArticle';
import HelpContentRenderer from '@/components/help/HelpContentRenderer';
import { useHelpContent } from '@/hooks/useHelpContent';

export default function HelpAccountRecovery() {
  const content = useHelpContent('account-recovery');
  if (!content) return null;
  return (
    <HelpArticle title={content.title} subtitle={content.subtitle} slug="account-recovery">
      <HelpContentRenderer content={content} />
    </HelpArticle>
  );
}