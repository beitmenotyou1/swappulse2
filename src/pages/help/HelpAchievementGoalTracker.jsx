import React from 'react';
import { Sparkles, Target, TrendingUp } from 'lucide-react';
import HelpArticle, { HelpSection, HelpList } from '@/components/help/HelpArticle';

export default function HelpAchievementGoalTracker() {
  return (
    <HelpArticle title="Achievement Goal Tracker" subtitle="AI help with collection goals" slug="achievement-goal-tracker">
      <HelpSection icon={Sparkles} title="What is the Achievement Goal Tracker?">
        <p>The Achievement Goal Tracker is an AI agent that helps you set and track realistic collection and achievement goals. It looks at your current collection, your progress toward achievements, and suggests achievable next steps.</p>
      </HelpSection>
      <HelpSection title="What it can help with">
        <HelpList>
          <li><b>Goal setting:</b> Realistic milestones based on your current collection size and activity.</li>
          <li><b>Progress tracking:</b> How close you are to specific achievements and what's needed.</li>
          <li><b>Next steps:</b> The most efficient path to your next badge or set completion.</li>
          <li><b>Timeline estimates:</b> Rough timeframes based on your activity rate.</li>
        </HelpList>
      </HelpSection>
      <HelpSection icon={Target} title="How it works">
        <p>The tracker reads your collection, achievements, and activity, then generates a personalised plan. It's conversational, so you can ask about specific achievements or adjust your goals.</p>
      </HelpSection>
      <HelpSection icon={TrendingUp} title="Using the plan">
        <p>The tracker's suggestions are motivational guides, not guarantees. Collect at your own pace and enjoy the hobby. Timelines are estimates based on past activity and can change.</p>
      </HelpSection>
    </HelpArticle>
  );
}