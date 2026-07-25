import React from 'react';
import { Radio, Square } from 'lucide-react';

// Profile action: a red, pulsing "Go Live" button when the collector is
// offline, or a secondary "End Stream" button while they are live.
export default function GoLiveControl({ liveSpace, onOpenModal, onEndStream, ending }) {
  if (!liveSpace) {
    return (
      <button
        onClick={onOpenModal}
        className="live-go-pulse flex items-center gap-1.5 rounded-lg bg-destructive px-3.5 py-2 text-sm font-bold text-white shadow-raised"
      >
        <Radio className="h-4 w-4" /> Go Live
      </button>
    );
  }
  return (
    <button
      onClick={onEndStream}
      disabled={ending}
      className="flex items-center gap-1.5 rounded-lg bg-secondary px-3.5 py-2 text-sm font-bold text-secondary-foreground disabled:opacity-50"
    >
      <Square className="h-3.5 w-3.5 fill-current" /> {ending ? 'Ending…' : 'End Stream'}
    </button>
  );
}