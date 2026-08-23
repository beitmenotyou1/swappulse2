import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Send, ArrowLeft, Sparkles, Plus, MessageSquare } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { base44 } from '@/api/base44Client';
import PageHeader from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import AgentFeedbackBar from '@/components/agents/AgentFeedbackBar';
import GuideFooterLink from '@/components/help/GuideFooterLink';
import useSEO from '@/hooks/useSEO';

const AGENT_NAME = 'collection_advisor';

function FunctionDisplay({ toolCall }) {
  const [expanded, setExpanded] = useState(false);
  const status = toolCall.status;
  const isError = status === 'failed' || status === 'error';
  let parsedResults = toolCall.results;
  if (typeof parsedResults === 'string') {
    try { parsedResults = JSON.parse(parsedResults); } catch { /* keep raw */ }
  }
  const failed = isError || (typeof parsedResults === 'object' && parsedResults?.success === false);
  const proj = toolCall.display_projection || {};
  const hideDetails = proj.hide_details && proj.details_redacted;

  const label = failed
    ? (proj.error_label || 'Failed')
    : status === 'pending' || status === 'running' || status === 'in_progress'
      ? (proj.active_label || 'Working…')
      : (proj.label || 'Done');

  let args = toolCall.arguments_string;
  try { args = JSON.parse(args); } catch { /* keep raw */ }

  return (
    <div className="mt-2 text-xs">
      <button
        onClick={() => setExpanded(!expanded)}
        className={`flex items-center gap-1.5 rounded-md px-2 py-1 font-semibold transition-colors ${
          failed ? 'bg-destructive/10 text-destructive' : 'bg-secondary text-muted-foreground'
        }`}
      >
        {status === 'pending' || status === 'running' || status === 'in_progress'
          ? <Loader2 className="h-3 w-3 animate-spin" />
          : failed
            ? <span className="text-destructive">✕</span>
            : <span className="text-success">✓</span>}
        {toolCall.name} · {label}
      </button>
      {expanded && !hideDetails && (
        <div className="mt-1.5 space-y-1 rounded-md bg-secondary/60 p-2">
          {args && (
            <div>
              <p className="font-bold text-muted-foreground">Parameters:</p>
              <pre className="overflow-x-auto whitespace-pre-wrap text-[11px]">{JSON.stringify(args, null, 2)}</pre>
            </div>
          )}
          {parsedResults != null && (
            <div>
              <p className="font-bold text-muted-foreground">Result:</p>
              <pre className="overflow-x-auto whitespace-pre-wrap text-[11px]">{JSON.stringify(parsedResults, null, 2)}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MessageBubble({ message, agentName, conversationId }) {
  const isUser = message.role === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm ${isUser ? 'bg-primary text-white' : 'bg-secondary'}`}>
        {message.content && (isUser
          ? <p className="whitespace-pre-wrap break-words">{message.content}</p>
          : <div className="prose prose-sm max-w-none prose-p:my-1 prose-ul:my-1 prose-li:my-0"><ReactMarkdown>{message.content}</ReactMarkdown></div>
        )}
        {message.tool_calls?.map((tc, i) => <FunctionDisplay key={i} toolCall={tc} />)}
        {!isUser && message.content && (
          <AgentFeedbackBar agentName={agentName} conversationId={conversationId} message={message} />
        )}
      </div>
    </div>
  );
}

export default function CollectionAdvisor() {
  useSEO({
    title: 'Collection Advisor',
    description: 'AI advisor for managing and growing your Pokémon TCG collection on SwapPulse.',
    canonicalPath: '/collection-advisor',
  });
  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loadingList, setLoadingList] = useState(true);
  const [loadingChat, setLoadingChat] = useState(false);
  const [sending, setSending] = useState(false);
  const endRef = useRef(null);

  // Load conversation list
  useEffect(() => {
    (async () => {
      try {
        const list = await base44.agents.listConversations({ agent_name: AGENT_NAME });
        setConversations(list || []);
      } catch { /* first-time user */ }
      finally { setLoadingList(false); }
    })();
  }, []);

  // Subscribe to active conversation
  useEffect(() => {
    if (!activeId) return;
    setLoadingChat(true);
    const unsub = base44.agents.subscribeToConversation(activeId, (data) => {
      setMessages(data.messages || []);
      setLoadingChat(false);
    });
    return () => unsub();
  }, [activeId]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages.length, sending]);

  const createNew = async () => {
    try {
      const conv = await base44.agents.createConversation({
        agent_name: AGENT_NAME,
        metadata: { name: 'Collection review', description: 'Analyse your collection & find trades' },
      });
      setConversations((prev) => [conv, ...prev]);
      setActiveId(conv.id);
      setMessages([]);
    } catch (e) {
      alert('Could not start conversation: ' + e.message);
    }
  };

  const send = async () => {
    const text = input.trim();
    if (!text || !activeId || sending) return;
    setSending(true);
    setInput('');
    try {
      const conv = conversations.find((c) => c.id === activeId);
      await base44.agents.addMessage(conv, { role: 'user', content: text });
    } catch (e) {
      alert('Could not send: ' + e.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div>
      <PageHeader title="Collection Advisor" subtitle="AI-powered analysis of your collection and trade opportunities">
        <Link to="/collection" className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Collection
        </Link>
      </PageHeader>

      <div className="flex gap-4 p-4" style={{ minHeight: 'calc(100vh - 120px)' }}>
        {/* Sidebar: conversation list */}
        <div className="hidden w-64 shrink-0 sm:block">
          <Button onClick={createNew} className="mb-3 w-full" size="sm">
            <Plus className="h-4 w-4" /> New chat
          </Button>
          {loadingList ? (
            <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
          ) : conversations.length === 0 ? (
            <p className="px-2 text-xs text-muted-foreground">No conversations yet.</p>
          ) : (
            <div className="space-y-1">
              {conversations.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setActiveId(c.id)}
                  className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors ${
                    c.id === activeId ? 'bg-primary/10 text-primary' : 'hover:bg-secondary'
                  }`}
                >
                  <MessageSquare className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{c.metadata?.name || 'Collection review'}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Main: chat area */}
        <div className="flex min-w-0 flex-1 flex-col rounded-2xl border border-border bg-card">
          {!activeId ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
              <div className="rounded-full bg-primary/10 p-4">
                <Sparkles className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-bold">Collection Advisor</h2>
                <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                  Get an AI analysis of your collection, find duplicates to trade, gaps to fill, cards to showcase, and active trade opportunities.
                </p>
              </div>
              <Button onClick={createNew}>
                <Plus className="h-4 w-4" /> Start a conversation
              </Button>
            </div>
          ) : (
            <>
              <div className="flex-1 space-y-3 overflow-y-auto p-4">
                {loadingChat && messages.length === 0 ? (
                  <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
                ) : (
                  messages.map((m, i) => <MessageBubble key={i} message={m} agentName={AGENT_NAME} conversationId={activeId} />)
                )}
                {sending && (
                  <div className="flex justify-start">
                    <div className="rounded-2xl bg-secondary px-3.5 py-2.5">
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    </div>
                  </div>
                )}
                <div ref={endRef} />
              </div>
              <div className="sticky bottom-0 border-t border-border bg-card p-3">
                <div className="flex items-end gap-2">
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    rows={1}
                    placeholder="Ask for a collection overview, trade suggestions, or set completion analysis…"
                    className="flex-1 resize-none rounded-2xl border border-border bg-secondary px-3 py-2 text-sm outline-none focus:border-primary"
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                  />
                  <button
                    onClick={send}
                    disabled={sending || !input.trim()}
                    className="rounded-full bg-primary p-2.5 text-white disabled:opacity-50"
                  >
                    {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </button>
                </div>
                <p className="mt-1.5 px-1 text-[11px] text-muted-foreground">
                  The advisor can read your collection, check market prices, and find trade opportunities.
                </p>
              </div>
            </>
          )}
        </div>
      </div>
      <GuideFooterLink slug="collection-advisor" />
    </div>
  );
}