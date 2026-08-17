import React from 'react';
import { Globe, Users, AtSign, Ban, MessageCircle, Eye } from 'lucide-react';

// Shared reply-policy + visibility-scope selector used by the Compose box,
// Quote modal, and any post surface that needs both controls. Renders the two
// rows in a single grouped card with a consistent icon+label button style so
// "who can reply" and "who can see" read as a matched pair across the site.

const REPLY_OPTIONS = [
  { value: 'everybody', icon: MessageCircle, label: 'Everyone' },
  { value: 'followers', icon: Users, label: 'Followers' },
  { value: 'mentioned', icon: AtSign, label: 'Mentioned' },
  { value: 'nobody', icon: Ban, label: 'No one' },
];

const SCOPE_OPTIONS = [
  { value: 'public', icon: Globe, label: 'Public' },
  { value: 'followers', icon: Users, label: 'Followers' },
  { value: 'mentioned', icon: AtSign, label: 'Mentioned' },
];

function Row({ icon: Icon, label, options, value, onChange }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </span>
      {options.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            aria-pressed={active}
            className={`flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              active
                ? 'bg-primary/15 text-primary'
                : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
            }`}
          >
            <o.icon className="h-3.5 w-3.5" />
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export default function VisibilityControls({
  replyPolicy,
  setReplyPolicy,
  visibilityScope,
  setVisibilityScope,
  className = '',
}) {
  return (
    <div className={`mt-3 space-y-2 rounded-xl border border-border bg-secondary/40 px-3 py-2.5 ${className}`}>
      <Row
        icon={MessageCircle}
        label="Who can reply"
        options={REPLY_OPTIONS}
        value={replyPolicy}
        onChange={setReplyPolicy}
      />
      <Row
        icon={Eye}
        label="Who can see"
        options={SCOPE_OPTIONS}
        value={visibilityScope}
        onChange={setVisibilityScope}
      />
    </div>
  );
}