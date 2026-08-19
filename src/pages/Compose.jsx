import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import ComposeBox from '@/components/feed/ComposeBox';
import PageHeader from '@/components/PageHeader';
import BlueskyLinkPrompt from '@/components/BlueskyLinkPrompt';
import GuideFooterLink from '@/components/help/GuideFooterLink';

export default function Compose() {
  const navigate = useNavigate();
  const location = useLocation();
  const replyTo = location.state?.replyTo || null;
  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title={replyTo ? 'Reply' : 'New Post'} />
      <BlueskyLinkPrompt />
      <ComposeBox onPosted={() => navigate('/')} replyTo={replyTo} />
      <GuideFooterLink slug="compose" />
    </div>
  );
}