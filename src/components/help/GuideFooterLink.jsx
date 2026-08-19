import React from 'react';
import { Link } from 'react-router-dom';
import { BookOpen } from 'lucide-react';
import { getGuideBySlug } from '@/lib/helpGuides';

export default function GuideFooterLink({ slug }) {
  const guide = getGuideBySlug(slug);
  if (!guide) return null;
  return (
    <div className="mt-8 border-t border-border pt-4">
      <Link
        to={`/help/${slug}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-primary"
      >
        <BookOpen className="h-4 w-4" />
        Read the guide: {guide.title}
      </Link>
    </div>
  );
}