import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2, MessageSquare } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import ConversationList from '@/components/messages/ConversationList';
import MessageThread from '@/components/messages/MessageThread';
import { base44 } from '@/api/base44Client';
import { ensureUserDid } from '@/lib/atproto';

export default function Messages() {
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [myDid, setMyDid] = useState('');

  const refresh = async (did) => {
    try {
      // Fetch conversations I created + ones where I'm the recipient.
      const [mine, theirs] = await Promise.all([
        base44.entities.Conversation.filter({ did }, '-last_message_at', 100).catch(() => []),
        base44.entities.Conversation.filter({ recipient_did: did }, '-last_message_at', 100).catch(() => []),
      ]);
      // Dedup by id (a conversation could appear in both if RLS allows).
      const byId = new Map();
      for (const c of [...mine, ...theirs]) byId.set(c.id, c);
      const sorted = [...byId.values()].sort(
        (a, b) => new Date(b.last_message_at || b.created_date || 0) - new Date(a.last_message_at || a.created_date || 0),
      );
      setConversations(sorted);
    } catch {
      setConversations([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    (async () => {
      const me = await base44.auth.me().catch(() => null);
      const { did } = await ensureUserDid().catch(() => ({ did: me?.did || '' }));
      if (!active || !did) { setLoading(false); return; }
      setMyDid(did);
      refresh(did);
      // Live subscription so new conversations and messages update the list.
      let unsub;
      try {
        unsub = base44.entities.Conversation.subscribe(() => refresh(did));
      } catch {}
      return () => { if (unsub) unsub(); };
    })();
    return () => { active = false; };
  }, []);

  const active = conversations.find((c) => c.id === conversationId);

  return (
    <div>
      <PageHeader title="Messages" subtitle="Private chats with other collectors" />
      <div className="flex h-[calc(100vh-8rem)] overflow-hidden">
        {/* Conversation list, hidden on mobile when a thread is open */}
        <div className={`w-full border-r border-border md:w-80 lg:w-96 ${conversationId ? 'hidden md:block' : 'block'}`}>
          {loading ? (
            <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : conversations.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center text-sm text-muted-foreground">
              <MessageSquare className="h-10 w-10 text-muted-foreground/50" />
              <p>No conversations yet.</p>
              <p>Tap Message on a collector's profile to start chatting.</p>
            </div>
          ) : (
            <ConversationList
              conversations={conversations}
              activeId={conversationId}
              myDid={myDid}
              onSelect={(c) => navigate(`/messages/${c.id}`)}
            />
          )}
        </div>

        {/* Thread, hidden on mobile when no thread is selected */}
        <div className={`flex-1 ${conversationId ? 'block' : 'hidden md:block'}`}>
          {active ? (
            <MessageThread
              key={active.id}
              conversation={active}
              myDid={myDid}
              onBack={() => navigate('/messages')}
            />
          ) : (
            <div className="flex h-full items-center justify-center p-8 text-center text-sm text-muted-foreground">
              <div>
                <MessageSquare className="mx-auto mb-3 h-12 w-12 text-muted-foreground/40" />
                <p>Select a conversation to start chatting.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}