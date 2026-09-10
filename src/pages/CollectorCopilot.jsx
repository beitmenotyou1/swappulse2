import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  BookOpen,
  Bot,
  Camera,
  Loader2,
  Languages,
  MessageSquare,
  Plus,
  Send,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import PageHeader from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import AgentFeedbackBar from '@/components/agents/AgentFeedbackBar';
import DocumentationLink from '@/components/DocumentationLink';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { LANGUAGES } from '@/hooks/useSettings';
import useSEO from '@/hooks/useSEO';

const AGENT_NAME = 'collector_copilot';

function visibleUserMessage(content) {
  return String(content || '').replace(
    /^\[SwapPulse Helper language: [^\]\n]+\]\n\n/,
    '',
  );
}

function ToolStatus({ toolCall }) {
  const status = toolCall.status;
  const failed = status === 'failed' || status === 'error';
  const running =
    status === 'pending' ||
    status === 'running' ||
    status === 'in_progress';
  const projection = toolCall.display_projection || {};
  const label = failed
    ? (projection.error_label || 'Could not retrieve data')
    : running
      ? (projection.active_label || 'Checking your data')
      : (projection.label || 'Source checked');

  return (
    <div
      className={`mt-2 inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-semibold ${
        failed
          ? 'bg-destructive/10 text-destructive'
          : 'bg-secondary text-muted-foreground'
      }`}
      role="status"
    >
      {running
        ? <Loader2 className="h-3 w-3 animate-spin" />
        : failed
          ? <span aria-hidden="true">✕</span>
          : <span className="text-success" aria-hidden="true">✓</span>}
      {label}
    </div>
  );
}

function MessageBubble({ message, conversationId }) {
  const isUser = message.role === 'user';
  const displayContent = isUser
    ? visibleUserMessage(message.content)
    : message.content;

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[90%] rounded-2xl px-3.5 py-2.5 text-sm sm:max-w-[85%] ${
          isUser ? 'bg-primary text-primary-foreground' : 'bg-secondary'
        }`}
      >
        {displayContent && (
          isUser
            ? <p className="whitespace-pre-wrap break-words">{displayContent}</p>
            : (
              <div className="prose prose-sm max-w-none prose-p:my-1 prose-ul:my-1 prose-li:my-0">
                <ReactMarkdown>{displayContent}</ReactMarkdown>
              </div>
            )
        )}
        {message.tool_calls?.map((toolCall, index) => (
          <ToolStatus key={`${toolCall.name || 'tool'}-${index}`} toolCall={toolCall} />
        ))}
        {!isUser && message.content && (
          <AgentFeedbackBar
            agentName={AGENT_NAME}
            conversationId={conversationId}
            message={message}
          />
        )}
      </div>
    </div>
  );
}

export default function CollectorCopilot() {
  const { t, locale, setLocale } = useI18n();
  const { user } = useAuth();
  const accountLocale = LANGUAGES.some((item) => item.code === user?.locale)
    ? user.locale
    : '';
  const [responseLocale, setResponseLocale] = useState(accountLocale || locale);
  const accountDefaultApplied = useRef(Boolean(accountLocale));
  const selectedLanguage = LANGUAGES.find((item) => item.code === responseLocale)
    || LANGUAGES[0];
  useSEO({
    title: t('copilot.title'),
    description: t('copilot.seoDescription'),
    canonicalPath: '/helper',
  });

  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loadingList, setLoadingList] = useState(true);
  const [loadingChat, setLoadingChat] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const endRef = useRef(null);

  useEffect(() => {
    if (accountDefaultApplied.current) return;
    if (accountLocale) {
      setResponseLocale(accountLocale);
      accountDefaultApplied.current = true;
    } else if (user) {
      setResponseLocale(locale);
      accountDefaultApplied.current = true;
    }
  }, [accountLocale, locale, user]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await base44.agents.listConversations(
          /** @type {any} */ ({ agent_name: AGENT_NAME }),
        );
        if (!cancelled) setConversations(list || []);
      } catch {
        if (!cancelled) setConversations([]);
      } finally {
        if (!cancelled) setLoadingList(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!activeId) return undefined;
    setLoadingChat(true);
    setError('');

    const unsubscribe = base44.agents.subscribeToConversation(
      activeId,
      (data) => {
        setMessages(data.messages || []);
        setLoadingChat(false);
      },
    );

    return () => unsubscribe();
  }, [activeId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, sending]);

  const createNew = async () => {
    setError('');
    try {
      const conversation = await base44.agents.createConversation({
        agent_name: AGENT_NAME,
        metadata: {
          name: t('copilot.conversationName'),
          description: t('copilot.conversationDescription'),
          locale: responseLocale,
          response_language: selectedLanguage.name,
        },
      });
      setConversations((current) => [conversation, ...current]);
      setActiveId(conversation.id);
      setMessages([]);
    } catch (requestError) {
      setError(requestError?.message || t('copilot.startError'));
    }
  };

  const sendText = async (value) => {
    const text = String(value || '').trim();
    if (!text || sending) return;

    setError('');
    setSending(true);
    setInput('');

    try {
      let conversation = conversations.find((item) => item.id === activeId);
      if (!conversation) {
        conversation = await base44.agents.createConversation({
          agent_name: AGENT_NAME,
          metadata: {
            name: t('copilot.conversationName'),
            description: t('copilot.conversationDescription'),
            locale: responseLocale,
            response_language: selectedLanguage.name,
          },
        });
        setConversations((current) => [conversation, ...current]);
        setActiveId(conversation.id);
        setMessages([]);
      }
      await base44.agents.addMessage(conversation, {
        role: 'user',
        content: `[SwapPulse Helper language: ${selectedLanguage.name} (${responseLocale})]\n\n${text}`,
      });
    } catch (requestError) {
      setInput(text);
      setError(requestError?.message || t('copilot.sendError'));
    } finally {
      setSending(false);
    }
  };

  const send = () => sendText(input);

  const suggestions = [
    {
      icon: Sparkles,
      label: t('copilot.prompt.collection'),
    },
    {
      icon: BookOpen,
      label: t('copilot.prompt.project'),
    },
    {
      icon: ShieldCheck,
      label: t('copilot.prompt.trade'),
    },
    {
      icon: Camera,
      label: t('copilot.prompt.scanner'),
    },
  ];

  return (
    <div>
      <PageHeader title={t('copilot.title')} subtitle={t('copilot.subtitle')}>
        <Link
          to="/collection"
          className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('nav.collection')}
        </Link>
      </PageHeader>

      <div className="px-4 pt-4">
        <div className="mb-3 flex flex-col gap-2 rounded-xl border border-border bg-card p-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2">
            <Languages className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <div>
              <label htmlFor="helper-language" className="text-sm font-bold">
                {t('copilot.languageLabel')}
              </label>
              <p className="text-xs text-muted-foreground">
                {t('copilot.languageHint')}
              </p>
            </div>
          </div>
          <select
            id="helper-language"
            value={responseLocale}
            onChange={(event) => {
              const nextLocale = event.target.value;
              setResponseLocale(nextLocale);
              setLocale(nextLocale);
            }}
            className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
          >
            {LANGUAGES.map((language) => (
              <option key={language.code} value={language.code}>
                {language.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-start gap-2 rounded-xl border border-primary/20 bg-primary/5 p-3 text-sm">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <p>
            <strong>{t('copilot.readOnlyTitle')}</strong>{' '}
            {t('copilot.readOnlyBody')}
          </p>
        </div>
      </div>

      <div className="px-4 pt-3">
        <Link
          to="/scan"
          className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 text-sm transition-colors hover:border-primary hover:bg-primary/5"
        >
          <div className="rounded-lg bg-primary/10 p-2 text-primary">
            <Camera className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-bold">{t('copilot.scannerTitle')}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {t('copilot.scannerBody')}
            </p>
          </div>
          <span className="shrink-0 font-semibold text-primary">
            {t('copilot.openScanner')}
          </span>
        </Link>
      </div>

      {error && (
        <div className="mx-4 mt-3 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div
        className="flex gap-4 p-4"
        style={{ minHeight: 'calc(100vh - 180px)' }}
      >
        <aside className="hidden w-64 shrink-0 sm:block">
          <Button onClick={createNew} className="mb-3 w-full" size="sm">
            <Plus className="h-4 w-4" />
            {t('copilot.newChat')}
          </Button>

          {loadingList ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : conversations.length === 0 ? (
            <p className="px-2 text-xs text-muted-foreground">
              {t('copilot.noConversations')}
            </p>
          ) : (
            <div className="space-y-1">
              {conversations.map((conversation) => (
                <button
                  key={conversation.id}
                  onClick={() => setActiveId(conversation.id)}
                  className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors ${
                    conversation.id === activeId
                      ? 'bg-primary/10 text-primary'
                      : 'hover:bg-secondary'
                  }`}
                >
                  <MessageSquare className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">
                    {conversation.metadata?.name || t('copilot.conversationName')}
                  </span>
                </button>
              ))}
            </div>
          )}
        </aside>

        <main className="flex min-w-0 flex-1 flex-col rounded-2xl border border-border bg-card">
          <div className="border-b border-border p-3 sm:hidden">
            <div className="flex gap-2">
              <select
                value={activeId || ''}
                onChange={(event) => setActiveId(event.target.value || null)}
                className="min-w-0 flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm"
                aria-label={t('copilot.chooseConversation')}
              >
                <option value="">{t('copilot.chooseConversation')}</option>
                {conversations.map((conversation) => (
                  <option key={conversation.id} value={conversation.id}>
                    {conversation.metadata?.name || t('copilot.conversationName')}
                  </option>
                ))}
              </select>
              <Button size="icon" onClick={createNew} aria-label={t('copilot.newChat')}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {!activeId ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-5 p-6 text-center sm:p-8">
              <div className="rounded-full bg-primary/10 p-4">
                <Bot className="h-9 w-9 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-bold">{t('copilot.welcomeTitle')}</h2>
                <p className="mt-2 max-w-xl text-sm text-muted-foreground">
                  {t('copilot.welcomeBody')}
                </p>
              </div>
              <div className="grid w-full max-w-2xl gap-2 sm:grid-cols-2">
                {suggestions.map(({ icon: Icon, label }) => (
                  <button
                    key={label}
                    onClick={() => sendText(label)}
                    disabled={sending}
                    className="flex items-center gap-2 rounded-xl border border-border p-3 text-left text-sm transition-colors hover:border-primary hover:bg-primary/5 disabled:opacity-50"
                  >
                    <Icon className="h-4 w-4 shrink-0 text-primary" />
                    <span>{label}</span>
                  </button>
                ))}
              </div>
              <Button onClick={createNew} disabled={sending}>
                <Plus className="h-4 w-4" />
                {t('copilot.startConversation')}
              </Button>
            </div>
          ) : (
            <>
              <div
                className="flex-1 space-y-3 overflow-y-auto p-4"
                aria-live="polite"
              >
                {loadingChat && messages.length === 0 ? (
                  <div className="flex justify-center py-16">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : (
                  messages.map((message, index) => (
                    <MessageBubble
                      key={message.id || index}
                      message={message}
                      conversationId={activeId}
                    />
                  ))
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
                    onChange={(event) => setInput(event.target.value)}
                    rows={1}
                    maxLength={4000}
                    placeholder={t('copilot.placeholder')}
                    className="flex-1 resize-none rounded-2xl border border-border bg-secondary px-3 py-2 text-sm outline-none focus:border-primary"
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && !event.shiftKey) {
                        event.preventDefault();
                        send();
                      }
                    }}
                    aria-label={t('copilot.placeholder')}
                  />
                  <button
                    onClick={send}
                    disabled={sending || !input.trim()}
                    className="rounded-full bg-primary p-2.5 text-primary-foreground disabled:opacity-50"
                    aria-label={t('copilot.send')}
                  >
                    {sending
                      ? <Loader2 className="h-4 w-4 animate-spin" />
                      : <Send className="h-4 w-4" />}
                  </button>
                </div>
                <p className="mt-1.5 px-1 text-[11px] text-muted-foreground">
                  {t('copilot.disclaimer')}
                </p>
              </div>
            </>
          )}
        </main>
      </div>

      <DocumentationLink slug="collector-copilot" />
    </div>
  );
}
