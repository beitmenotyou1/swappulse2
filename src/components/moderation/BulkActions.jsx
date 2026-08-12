import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Check, X, ShieldAlert } from 'lucide-react';

export default function BulkActions({ selectedCount, onBulk, onClear }) {
  if (selectedCount === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3">
      <span className="text-sm font-semibold">{selectedCount} selected</span>
      <div className="ml-auto flex flex-wrap gap-2">
        <Button size="sm" onClick={() => onBulk('approve_all')}>
          <Check className="h-4 w-4" /> Approve All
        </Button>
        <BulkConfirm label="Dismiss All" action="dismiss_all" icon={X} variant="secondary" selectedCount={selectedCount} onBulk={onBulk} />
        <BulkConfirm label="Escalate All" action="escalate_all" icon={ShieldAlert} variant="destructive" selectedCount={selectedCount} onBulk={onBulk} />
        <Button size="sm" variant="ghost" onClick={onClear}>
          Clear
        </Button>
      </div>
    </div>
  );
}

function BulkConfirm({ label, action, icon: Icon, variant, selectedCount, onBulk }) {
  const [open, setOpen] = useState(false);
  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button size="sm" variant={variant}>
          <Icon className="h-4 w-4" /> {label}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Confirm {label}</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to {label.toLowerCase()} {selectedCount} flagged posts? This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              onBulk(action);
              setOpen(false);
            }}
          >
            Confirm
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}