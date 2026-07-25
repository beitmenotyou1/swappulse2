import React from 'react';
import { Heart } from 'lucide-react';

// Friends badge - shown on profiles where a mutual accepted friendship exists.
// Pill: auto width, 24px height, 12px radius, primary bg, white text, heart icon.
export default function FriendsBadge({ isFriend }) {
  if (!isFriend) return null;
  return (
    <span className="inline-flex h-6 items-center gap-1 rounded-xl bg-primary px-2 text-xs font-bold text-white">
      <Heart className="h-3 w-3 fill-current" /> Friends
    </span>
  );
}