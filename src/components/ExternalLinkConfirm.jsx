import React, { useState, useEffect } from 'react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { ExternalLink } from 'lucide-react';
import { subscribeExternalLink, clearExternalLink } from '@/lib/externalLink';

// Mounted once at the app root. Listens for external-link confirmation
// requests from any RichText/RichLink instance and shows a single shared
// dialog. On Continue, opens the URL in a new tab with noopener/noreferrer.
export default function ExternalLinkConfirm() {
  const [url, setUrl] = useState(null);

  useEffect(() => subscribeExternalLink(setUrl), []);

  const isOpen = url !== null;

  const handleContinue = () => {
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
    clearExternalLink();
  };

  const handleCancel = () => clearExternalLink();

  return (
    <AlertDialog open={isOpen} onOpenChange={(o) => !o && handleCancel()}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <ExternalLink className="h-5 w-5 text-primary" />
            Leaving SwapPulse
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2">
              <p>You're about to open an external link. It will open in a new tab.</p>
              {url && (
                <p className="break-all rounded-lg bg-secondary px-3 py-2 font-mono text-xs text-muted-foreground">
                  {url}
                </p>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleCancel}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleContinue}>Continue</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}