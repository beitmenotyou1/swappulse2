import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import ComposeBox from '@/components/feed/ComposeBox';
import PageHeader from '@/components/PageHeader';

export default function Compose() {
  const navigate = useNavigate();
  const location = useLocation();
  const replyTo = location.state?.replyTo || null;
  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title={replyTo ? 'Reply' : 'New Post'} />
      <ComposeBox onPosted={() => navigate('/')} replyTo={replyTo} />
    </div>
  );
}