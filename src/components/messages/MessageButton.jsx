import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageSquare, Loader2 } from 'lucide-react';
import { startOrFindConversation } from '@/lib/dmBridge';

// Inline Message button for profile pages. Starts or reuses a conversation with
// the target collector, then navigates to the thread.
export default function MessageButton({ targetDid, targetName, targetHandle, targetAvatar, className = '' }) {
  const navigate = useNavigate();
  const [starting, setStarting] = useState(false);

  const handleClick = async () => {
    if (starting || !targetDid) return;
    setStarting(true);
    try {
      const convo = await startOrFindConversation(targetDid, targetName, targetHandle, targetAvatar);
      navigate(`/messages/${convo.id}`);
    } catch {
      setStarting(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={starting}
      className={`inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-secondary disabled:opacity-50 ${className}`}
      aria-label={`Message ${targetName || 'collector'}`}
    >
      {starting ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquare className="h-4 w-4" />}
      <span className="hidden sm:inline">Message</span>
    </button>
  );
}