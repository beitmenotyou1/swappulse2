import React from 'react';
import { Award, FileText, Send, Clock } from 'lucide-react';
import HelpArticle, { HelpSection, HelpSteps, HelpList } from '@/components/help/HelpArticle';

export default function HelpGrading() {
  return (
    <HelpArticle title="Grading" subtitle="Prepare grading submissions and track condition reports" slug="grading">
      <HelpSection icon={Award} title="What is the Grading page?">
        <p>The Grading page helps you prepare cards for professional grading submission (PSA, Beckett, CGC, etc.). Track which cards you're submitting, record their pre-grade condition, and keep a history of your grading results.</p>
      </HelpSection>
      <HelpSection title="What you can do">
        <HelpList>
          <li><b>Create a submission:</b> Group cards you're sending to a grading company into a single submission batch.</li>
          <li><b>Record condition:</b> Note the pre-submission condition of each card (centering, corners, edges, surface).</li>
          <li><b>Track status:</b> Mark submissions as sent, in review, returned, and record the final grade.</li>
          <li><b>View history:</b> See all your past grading submissions and their results.</li>
        </HelpList>
      </HelpSection>
      <HelpSection icon={FileText} title="Creating a grading submission">
        <HelpSteps>
          <li>Open the Grading page from your navigation.</li>
          <li>Click New Submission and select a grading company (PSA, BGS, CGC, or other).</li>
          <li>Add cards from your collection to the submission batch.</li>
          <li>Record the condition details for each card.</li>
          <li>Save the submission. You can update its status as it progresses.</li>
        </HelpSteps>
      </HelpSection>
      <HelpSection icon={Send} title="Tracking status">
        <p>Update the submission status as it moves through the grading process: prepared, sent, in review, returned. When the card comes back, record the final grade so it's linked to your collection entry.</p>
      </HelpSection>
      <HelpSection icon={Clock} title="Why track grades?">
        <p>Graded cards carry a verified condition and grade that affects their value. Keeping a record lets you compare pre-grade condition assessments with actual results over time, and provides provenance when trading or selling.</p>
      </HelpSection>
      <HelpSection title="Tips" variant="primary">
        <HelpList>
          <li>Only add cards that are actually in your collection to a submission, so grading records stay linked.</li>
          <li>Record honest condition assessments, they help you learn which flaws graders flag.</li>
        </HelpList>
      </HelpSection>
    </HelpArticle>
  );
}