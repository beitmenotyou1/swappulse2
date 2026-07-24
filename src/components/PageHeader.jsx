import React from 'react';

export default function PageHeader({ title, subtitle, children }) {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur">
      <div className="flex items-center justify-between px-4 py-3">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight">{title}</h1>
          {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        {children}
      </div>
    </header>
  );
}