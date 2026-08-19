import React from 'react';
import { Vote, Plus, BarChart3, Clock } from 'lucide-react';
import HelpArticle, { HelpSection, HelpSteps, HelpList } from '@/components/help/HelpArticle';

export default function HelpPredictions() {
  return (
    <HelpArticle title="Predictions & Polls" subtitle="Community sentiment polls" slug="predictions">
      <HelpSection icon={Vote} title="What are Predictions?">
        <p>Predictions are community sentiment polls about cards, the meta, and the market. Create a poll, let the community vote, and see the results in real time. It's a lightweight way to gauge community opinion on any TCG topic.</p>
      </HelpSection>
      <HelpSection title="What you can do">
        <HelpList>
          <li><b>Create a poll:</b> Ask a question with multiple options.</li>
          <li><b>Vote:</b> Cast your vote on any open poll.</li>
          <li><b>View results:</b> See live results as the community votes.</li>
          <li><b>Close a poll:</b> The creator can close voting when ready.</li>
        </HelpList>
      </HelpSection>
      <HelpSection icon={Plus} title="Creating a poll">
        <HelpSteps>
          <li>Go to the Predictions page and click Create Poll.</li>
          <li>Write your question and add 2 or more answer options.</li>
          <li>Optionally set a closing time.</li>
          <li>Publish. Your poll appears on the Predictions page.</li>
        </HelpSteps>
      </HelpSection>
      <HelpSection icon={BarChart3} title="Results">
        <p>Results update live as votes come in. You can see the percentage for each option and the total vote count. After a poll closes, the final results are archived.</p>
      </HelpSection>
      <HelpSection icon={Clock} title="Closing and resolution">
        <p>Polls can close automatically at a set time or manually by the creator. The Sentiment Assistant can also help analyse community sentiment trends across polls over time.</p>
      </HelpSection>
    </HelpArticle>
  );
}