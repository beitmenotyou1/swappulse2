import React from 'react';
import { useNavigate } from 'react-router-dom';
import ComposeBox from '@/components/feed/ComposeBox';
import PageHeader from '@/components/PageHeader';

export default function Compose() {
  const navigate = useNavigate();
  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title="New Post" />
      <ComposeBox onPosted={() => navigate('/')} />
    </div>
  );
}