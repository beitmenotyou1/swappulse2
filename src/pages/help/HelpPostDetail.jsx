import React from 'react';
import { MessageSquare, Reply, Heart, Repeat2, Flag } from 'lucide-react';
import HelpArticle, { HelpSection, HelpSteps, HelpList } from '@/components/help/HelpArticle';

export default function HelpPostDetail() {
  return (
    <HelpArticle title="Posts & Replies" subtitle="View, reply, react, and repost" slug="post-detail">
      <HelpSection icon={MessageSquare} title="What is a post detail page?">
        <p>Every post has a detail page at /post/:postId (or /post/at/:atUri for federated posts). It shows the full post, its attached card if any, the reply thread, reactions, and reposts. It's where conversations happen.</p>
      </HelpSection>
      <HelpSection title="What you can do">
        <HelpList>
          <li><b>Reply:</b> Add your reply to the thread. Replies respect the post's reply policy.</li>
          <li><b>React:</b> Add a reaction (emoji) to the post.</li>
          <li><b>Repost:</b> Repost to your followers, with or without your own commentary (quote).</li>
          <li><b>Quote:</b> Layer your own post over this one as a quote.</li>
          <li><b>Share:</b> Copy the link or share inside SwapPulse.</li>
          <li><b>Report:</b> Flag the post for moderator review if it breaks community rules.</li>
        </HelpList>
      </HelpSection>
      <HelpSection icon={Reply} title="Replying">
        <HelpSteps>
          <li>Click Reply on any post or in the detail page.</li>
          <li>Write your reply (up to 500 characters).</li>
          <li>Post. Your reply appears in the thread below.</li>
        </HelpSteps>
        <p>Replies are threaded. The original post, parent replies, and the full conversation tree are all visible on the detail page.</p>
      </HelpSection>
      <HelpSection icon={Heart} title="Reactions and likes">
        <p>React to posts with emoji reactions. Likes are tracked and visible on the post. Your likes are private to you unless you choose to surface them.</p>
      </HelpSection>
      <HelpSection icon={Repeat2} title="Reposting and quoting">
        <p>Repost to share someone's post with your followers. Quote to add your own commentary above the original. Both create a new post that references the original, and both federate to Bluesky.</p>
      </HelpSection>
      <HelpSection icon={Flag} title="Reporting a post">
        <p>If a post is spam, abusive, or breaks the rules, click Report and choose a reason. It goes to the moderation queue for review. AI moderation also scans posts automatically for harmful content.</p>
      </HelpSection>
    </HelpArticle>
  );
}