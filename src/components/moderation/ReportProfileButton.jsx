import React, { useState } from 'react';
import { Flag } from 'lucide-react';
import ReportDialog from '@/components/moderation/ReportDialog';

// Report button for profile surfaces. Opens the ReportDialog with
// content_type 'profile' and the profile's id + handle.
export default function ReportProfileButton({ profileId, profileHandle, profileName, className = '' }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:bg-secondary hover:text-destructive ${className}`}
        aria-label={`Report ${profileName || 'this profile'}`}
      >
        <Flag className="h-4 w-4" />
        <span className="hidden sm:inline">Report</span>
      </button>
      <ReportDialog
        open={open}
        onOpenChange={setOpen}
        contentType="profile"
        contentId={profileId}
        contentPreview={profileName ? `Profile: ${profileName}` : ''}
        authorHandle={profileHandle || ''}
      />
    </>
  );
}