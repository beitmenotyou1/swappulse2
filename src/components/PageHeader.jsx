import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

const HIDE_BACK_PATHS = ['/', '/explore', '/trades', '/collection'];

export default function PageHeader({ title, subtitle, icon, children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const canGoBack = !HIDE_BACK_PATHS.includes(location.pathname);
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/80 pt-[env(safe-area-inset-top,20px)] backdrop-blur">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2 min-w-0">
          {canGoBack && (
            <button
              onClick={() => navigate(-1)}
              aria-label="Go back"
              className="shrink-0 rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          )}
          {icon && <div className="shrink-0">{icon}</div>}
          <div className="min-w-0">
            <h1 className="truncate text-xl font-extrabold tracking-tight">{title}</h1>
            {subtitle && <p className="truncate text-sm text-muted-foreground">{subtitle}</p>}
          </div>
        </div>
        {children}
      </div>
    </header>
  );
}