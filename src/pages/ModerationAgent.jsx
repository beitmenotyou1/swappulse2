import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Send, ArrowLeft, Sparkles, Plus, MessageSquare, ShieldAlert, Flag } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import PageHeader from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import AgentFeedbackBar from '@/components/agents/AgentFeedbackBar';
import useSEO from '@/hooks/useSEO';

const AGENT_NAME = 'moderation_agent';

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

function FlaggedItem({ item, onSelect }) {
  const maxConf = Math.max(0, ...item.labels.map((l) => (l.confidence || 0) * 100));
  const aiLabel = item.labels.find((l) => l.ai_generated);
  return (
    <button
      onClick={() => onSelect(item)}
      className="w-full rounded-lg border border-border p-2.5 text-left transition-colors hover:bg-secondary"
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold">{item.author.displayName}</span>
        <span className="text-[11px] text-muted-foreground">{Math.round(maxConf)}%</span>
      </div>
      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{item.post.text}</p>
      <div className="mt-1.5 flex flex-wrap gap-1">
        {item.labels.slice(0, 3).map((l, i) => (
          <span key={i} className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
            l.severity === 'escalate' ? 'bg-destructive/15 text-destructive' :
            l.severity === 'warn' ? 'bg-warning/15 text-warning' :
            'bg-secondary text-muted-foreground'
          }`}>
            {l.label.replace('hashtag-', '')}
            {l.ai_generated && ' · AI'}
          </span>
        ))}
      </div>
      {aiLabel && (
        <p className="mt-1 text-[10px] text-primary">AI: {aiLabel.recommended_action}</p>
      )}
    </button>
  );
}

export default function ModerationAgent() {
  const { user } = useAuth();
  useSEO({
    title: 'Moderation Agent',
    description: 'AI-powered moderation assistant for reviewing flagged content on SwapPulse.',
    canonicalPath: '/moderation-agent',
  });
  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loadingList, setLoadingList] = useState(true);
  const [loadingChat, setLoadingChat] = useState(false);
  const [sending, setSending] = useState(false);
  const [flagged, setFlagged] = useState([]);
  const [loadingFlagged, setLoadingFlagged] = useState(true);
  const [reports, setReports] = useState([]);
  const [loadingReports, setLoadingReports] = useState(true);
  const endRef = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const list = await base44.agents.listConversations({ agent_name: AGENT_NAME });
        setConversations(list || []);
      } catch { /* first-time user */ }
      finally { setLoadingList(false); }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await base44.functions.invoke('moderation', { op: 'list', status: ['pending'], pageSize: 10 });
        setFlagged(res.data?.posts || []);
      } catch { /* ignore */ }
      finally { setLoadingFlagged(false); }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const list = await base44.entities.ContentReport.filter({ status: 'pending' }, '-created_date', 10);
        setReports(list || []);
      } catch { /* ignore */ }
      finally { setLoadingReports(false); }
    })();
  }, []);

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
        metadata: { name: 'Moderation review', description: 'Review flagged content with AI' },
      });
      setConversations((prev) => [conv, ...prev]);
      setActiveId(conv.id);
      setMessages([]);
    } catch (e) {
      alert('Could not start conversation: ' + e.message);
    }
  };

  const send = async (text) => {
    const msg = (text || input).trim();
    if (!msg || !activeId || sending) return;
    setSending(true);
    setInput('');
    try {
      const conv = conversations.find((c) => c.id === activeId);
      await base44.agents.addMessage(conv, { role: 'user', content: msg });
    } catch (e) {
      alert('Could not send: ' + e.message);
    } finally {
      setSending(false);
    }
  };

  const selectFlagged = (item) => {
    if (!activeId) {
      alert('Start a conversation first, then select a flagged item.');
      return;
    }
    const msg = `Please review post ${item.id} by ${item.author.displayName}. The content is: "${item.post.text?.slice(0, 300)}". Analyse it and recommend a moderation action.`;
    send(msg);
  };

  const selectReport = (report) => {
    if (!activeId) {
      alert('Start a conversation first, then select a report.');
      return;
    }
    const msg = `A user reported a ${report.content_type} (id: ${report.content_id}) by @${report.author_handle || 'unknown'} for "${report.reason.replace('_', ' ')}". ${report.details ? `User details: "${report.details.slice(0, 300)}".` : ''} Content preview: "${(report.content_preview || '').slice(0, 300)}". Please analyse whether this violates our guidelines and recommend a moderation action.`;
    send(msg);
  };

  if (user?.role !== 'admin' && user?.role !== 'moderator') {
    return (
      <div className="mx-auto max-w-md p-8 text-center">
        <ShieldAlert className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
        <h1 className="text-xl font-bold">Staff only</h1>
        <p className="text-sm text-muted-foreground">The AI moderation agent is restricted to staff and administrators.</p>
      </div>
    );
  }

  const activeConv = conversations.find((c) => c.id === activeId);

  return (
    <div>
      <PageHeader title="AI Moderation Agent" subtitle="Review flagged content with AI assistance">
        <Link to="/moderation" className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Dashboard
        </Link>
      </PageHeader>

      <div className="flex gap-4 p-4" style={{ minHeight: 'calc(100vh - 120px)' }}>
        {/* Sidebar: flagged queue + conversations */}
        <div className="hidden w-64 shrink-0 sm:block">
          <Button onClick={createNew} className="mb-3 w-full" size="sm">
            <Plus className="h-4 w-4" /> New review
          </Button>

          {/* Flagged items */}
          <div className="mb-4">
            <div className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase text-muted-foreground">
              <Flag className="h-3.5 w-3.5" /> Flagged Queue
            </div>
            {loadingFlagged ? (
              <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
            ) : flagged.length === 0 ? (
              <p className="px-2 text-xs text-muted-foreground">No pending flags.</p>
            ) : (
              <div className="space-y-2">
                {flagged.map((item) => (
                  <FlaggedItem key={item.id} item={item} onSelect={selectFlagged} />
                ))}
              </div>
            )}
          </div>

          {/* User reports */}
          <div className="mb-4 border-t border-border pt-3">
            <div className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase text-muted-foreground">
              <Flag className="h-3.5 w-3.5" /> User Reports
            </div>
            {loadingReports ? (
              <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
            ) : reports.length === 0 ? (
              <p className="px-2 text-xs text-muted-foreground">No pending reports.</p>
            ) : (
              <div className="space-y-2">
                {reports.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => selectReport(r)}
                    className="w-full rounded-lg border border-border p-2.5 text-left transition-colors hover:bg-secondary"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold capitalize">{r.reason.replace('_', ' ')}</span>
                      <span className="text-[10px] text-muted-foreground">{r.content_type}</span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{r.content_preview || r.details || 'No preview'}</p>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Conversations */}
          <div className="border-t border-border pt-3">
            <p className="mb-2 text-xs font-bold uppercase text-muted-foreground">Reviews</p>
            {loadingList ? (
              <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
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
                    <span className="truncate">{c.metadata?.name || 'Review'}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Main: chat area */}
        <div className="flex min-w-0 flex-1 flex-col rounded-2xl border border-border bg-card">
          {!activeId ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
              <div className="rounded-full bg-primary/10 p-4">
                <Sparkles className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-bold">AI Moderation Agent</h2>
                <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                  Review flagged content, get AI-powered analysis, draft warning messages, and execute moderation decisions.
                </p>
              </div>
              <Button onClick={createNew}>
                <Plus className="h-4 w-4" /> Start a review
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
                    placeholder="Paste a post ID, ask for analysis, or request a warning draft…"
                    className="flex-1 resize-none rounded-2xl border border-border bg-secondary px-3 py-2 text-sm outline-none focus:border-primary"
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                   aria-label="Paste a post ID, ask for analysis, or request a warning draft…"/>
                  <button
                    onClick={() => send()}
                    disabled={sending || !input.trim()}
                    className="rounded-full bg-primary p-2.5 text-white disabled:opacity-50"
                  >
                    {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </button>
                </div>
                <p className="mt-1.5 px-1 text-[11px] text-muted-foreground">
                  The agent can read posts, listings, messages, and profiles, and apply moderation labels.
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}