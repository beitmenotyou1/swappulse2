import React from 'react';
import { formatNumber } from '@/lib/format';

// ProfileMetricsBar — single-row followers · following · posts display,
// styled after the X-style reference: bold number + grey lowercase label,
// separated by middots. Purely presentational; no navigation.
export default function ProfileMetricsBar({ followers = 0, following = 0, posts = 0 }) {
  const Metric = ({ value, label }) => (
    <span className="inline-flex items-baseline gap-1">
      <b className="text-foreground">{formatNumber(value)}</b>
      <span className="text-muted-foreground">{label}</span>
    </span>
  );
  return (
    <div className="mt-2 flex items-center gap-3 text-sm">
      <Metric value={followers} label="followers" />
      <span className="text-muted-foreground/50">·</span>
      <Metric value={following} label="following" />
      <span className="text-muted-foreground/50">·</span>
      <Metric value={posts} label="posts" />
    </div>
  );
}