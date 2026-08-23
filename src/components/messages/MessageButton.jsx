import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageSquare, Loader2, UserPlus } from 'lucide-react';
import { startOrFindConversation } from '@/lib/dmBridge';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';

// Inline Message button for profile pages. DMs are restricted to accepted
// friends: if the two collectors aren't friends yet, the button becomes an
// "Add friend" CTA instead of starting a conversation.
export default function MessageButton({ targetDid, targetName, targetHandle, targetAvatar, className = '' }) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [state, setState] = useState('checking'); // checking | friends | not_friends | pending_out | pending_in
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!targetDid) { setState('not_friends'); return; }
    base44.functions.invoke('check-friendship', { targetDid })
      .then((res) => {
        if (cancelled) return;
        const status = res?.data?.status || 'none';
        if (status === 'accepted') setState('friends');
        else if (status === 'pending' && res?.data?.direction === 'outgoing') setState('pending_out');
        else if (status === 'pending' && res?.data?.direction === 'incoming') setState('pending_in');
        else setState('not_friends');
      })
      .catch(() => { if (!cancelled) setState('not_friends'); });
    return () => { cancelled = true; };
  }, [targetDid]);

  const handleClick = async () => {
    if (starting || state !== 'friends' || !targetDid) return;
    setStarting(true);
    try {
      const convo = await startOrFindConversation(targetDid, targetName, targetHandle, targetAvatar);
      navigate(`/messages/${convo.id}`);
    } catch {
      setStarting(false);
    }
  };

  const sendFriendRequest = async () => {
    if (!targetDid) return;
    setStarting(true);
    try {
      const me = await base44.auth.me();
      const myDid = me?.data?.did || '';
      if (!myDid) { toast({ title: 'Identity not ready', variant: 'destructive' }); return; }
      await base44.entities.Friendship.create({
        friend_did: targetDid,
        friend_name: targetName || '',
        friend_handle: targetHandle || '',
        status: 'pending',
        initiated_by: myDid,
        did: myDid,
      });
      setState('pending_out');
      toast({ title: 'Friend request sent', description: 'You can message once they accept.' });
    } catch (e) {
      toast({ title: 'Could not send request', description: e.message, variant: 'destructive' });
    } finally {
      setStarting(false);
    }
  };

  if (state === 'checking') {
    return (
      <button disabled className={`inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-semibold text-muted-foreground ${className}`}>
        <Loader2 className="h-4 w-4 animate-spin" />
      </button>
    );
  }

  if (state === 'friends') {
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

  if (state === 'pending_out') {
    return (
      <button disabled className={`inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-semibold text-muted-foreground ${className}`}>
        <UserPlus className="h-4 w-4" /> <span className="hidden sm:inline">Request sent</span>
      </button>
    );
  }

  if (state === 'pending_in') {
    return (
      <button disabled className={`inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-semibold text-muted-foreground ${className}`}>
        <UserPlus className="h-4 w-4" /> <span className="hidden sm:inline">Wants to be friends</span>
      </button>
    );
  }

  // not_friends
  return (
    <button
      onClick={sendFriendRequest}
      disabled={starting}
      className={`inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50 ${className}`}
      aria-label={`Add ${targetName || 'collector'} as a friend to message`}
    >
      {starting ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
      <span className="hidden sm:inline">Add friend to message</span>
    </button>
  );
}