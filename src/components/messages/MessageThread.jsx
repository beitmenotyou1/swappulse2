import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Send } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import Avatar from '@/components/Avatar';
import MessageBubble from '@/components/messages/MessageBubble';
import { sendDirectMessage, markConversationRead } from '@/lib/dmBridge';

export default function MessageThread({ conversation, myDid, onBack }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef(null);

  const refresh = async () => {
    if (!conversation?.id) return;
    try {
      const list = await base44.entities.DirectMessage.filter(
        { conversation_id: conversation.id },
        'created_date',
        200,
      );
      setMessages(list);
    } catch {
      setMessages([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    refresh();
    // Mark messages as read when the thread is opened.
    if (myDid) markConversationRead(conversation.id, myDid).then(refresh).catch(() => {});
    // Live subscription for real-time delivery.
    let unsub;
    try {
      unsub = base44.entities.DirectMessage.subscribe(() => refresh());
    } catch {}
    return () => { if (unsub) unsub(); };
  }, [conversation?.id, myDid]);

  // Auto-scroll to the latest message.
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const handleSend = async () => {
    if (!text.trim() || sending) return;
    setSending(true);
    setText('');
    try {
      const me = await base44.auth.me().catch(() => null);
      await sendDirectMessage(conversation, text, me);
      await refresh();
    } catch {
      // Rollback text so the user can retry.
      setText(text);
    } finally {
      setSending(false);
    }
  };

  const otherName = conversation?.recipient_name || conversation?.recipient_handle || 'Collector';
  const otherAvatar = conversation?.recipient_avatar;

  return (
    <div className="flex h-full flex-col">
      {/* Thread header */}
      <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
        <button onClick={onBack} className="rounded-full p-1.5 hover:bg-secondary md:hidden" aria-label="Back">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <Avatar name={otherName} src={otherAvatar} size={36} />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{otherName}</p>
          <p className="truncate text-xs text-muted-foreground">@{conversation?.recipient_handle || 'collector'}</p>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-3">
        {loading ? (
          <div className="flex justify-center py-10 text-sm text-muted-foreground">Loading…</div>
        ) : messages.length === 0 ? (
          <div className="flex justify-center py-10 text-center text-sm text-muted-foreground">
            Say hello — send the first message.
          </div>
        ) : (
          messages.map((m) => (
            <MessageBubble key={m.id} message={m} isMine={m.did === myDid} />
          ))
        )}
      </div>

      {/* Composer */}
      <div className="flex items-center gap-2 border-t border-border p-3">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          rows={1}
          placeholder="Type a message…"
          className="flex-1 resize-none rounded-2xl border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          maxLength={2000}
        />
        <button
          onClick={handleSend}
          disabled={!text.trim() || sending}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-40"
          aria-label="Send message"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}