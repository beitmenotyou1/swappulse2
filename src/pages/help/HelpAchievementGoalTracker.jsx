import React from 'react';
import HelpArticle from '@/components/help/HelpArticle';
import HelpContentRenderer from '@/components/help/HelpContentRenderer';
import { useHelpContent } from '@/hooks/useHelpContent';

export default function HelpAchievementGoalTracker() {
  const content = useHelpContent('achievement-goal-tracker');
  if (!content) return null;
  return (
    <HelpArticle title={content.title} subtitle={content.subtitle} slug="achievement-goal-tracker">
      <HelpContentRenderer content={content} />
    </HelpArticle>
  );
}