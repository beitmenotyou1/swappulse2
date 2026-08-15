import React from 'react';

export default function NotificationGroup({ title, children }) {
  if (!children || (Array.isArray(children) && children.length === 0)) return null;
  return (
    <div>
      <div className="border-b border-border bg-muted/50 px-4 py-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
        {title}
      </div>
      <div className="divide-y divide-border">{children}</div>
    </div>
  );
}