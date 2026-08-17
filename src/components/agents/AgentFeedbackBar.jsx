import React, { useState } from 'react';
import { ThumbsUp, ThumbsDown, Loader2, Check, X } from 'lucide-react';
import { base44 } from '@/api/base44Client';

// AgentFeedbackBar — thumbs up/down + correction input on each assistant message.
// Logs to AgentFeedback entity; the daily learning loop workflow processes it
// into AgentInsight records that the agent reads before responding.
export default function AgentFeedbackBar({ agentName, conversationId, message }) {
  const [submitted, setSubmitted] = useState(null);
  const [showCorrection, setShowCorrection] = useState(false);
  const [correction, setCorrection] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (type, correctedContent = '') => {
    setSaving(true);
    try {
      await base44.entities.AgentFeedback.create({
        agent_name: agentName,
        conversation_id: conversationId || '',
        message_id: message.id || '',
        feedback_type: type,
        original_content: (message.content || '').slice(0, 2000),
        corrected_content: correctedContent || '',
        processed: false,
      });
      setSubmitted(type === 'thumbs_up' ? 'up' : 'down');
      setShowCorrection(false);
    } catch {
      // silent fail — don't disrupt the chat experience
    } finally {
      setSaving(false);
    }
  };

  if (submitted) {
    return (
      <div className="mt-1.5 flex items-center gap-1 text-[11px] text-muted-foreground">
        <Check className="h-3 w-3 text-success" /> Thanks for the feedback
      </div>
    );
  }

  return (
    <div className="mt-1.5">
      <div className="flex items-center gap-1">
        <button
          onClick={() => submit('thumbs_up')}
          disabled={saving}
          className="rounded p-1 text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
          title="Helpful"
        >
          {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <ThumbsUp className="h-3 w-3" />}
        </button>
        <button
          onClick={() => setShowCorrection(true)}
          disabled={saving}
          className="rounded p-1 text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
          title="Not helpful, suggest improvement"
        >
          <ThumbsDown className="h-3 w-3" />
        </button>
      </div>
      {showCorrection && (
        <div className="mt-1.5 flex items-end gap-1">
          <textarea
            value={correction}
            onChange={(e) => setCorrection(e.target.value)}
            rows={2}
            placeholder="What should the agent have said or done differently?"
            className="flex-1 resize-none rounded-lg border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-primary"
          />
          <div className="flex gap-1">
            <button
              onClick={() => submit('correction', correction)}
              disabled={saving || !correction.trim()}
              className="rounded-lg bg-primary px-2 py-1.5 text-xs font-bold text-white disabled:opacity-50"
            >
              Send
            </button>
            <button
              onClick={() => setShowCorrection(false)}
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-background"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}