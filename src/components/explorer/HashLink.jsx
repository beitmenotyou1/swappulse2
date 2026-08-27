import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Copy, Check } from 'lucide-react';
import { useT } from '@/lib/i18n/I18nProvider';
import { truncateHash } from '@/lib/explorerFormat';

// Truncated monospace hash with a copy button and a link to a detail page.
export default function HashLink({ hash, to, prefixLen = 10, suffixLen = 8, className = '' }) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  if (!hash) return <span className="text-muted-foreground text-xs">—</span>;

  const copy = (e) => {
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard?.writeText(hash);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <span className={`inline-flex items-center gap-1 font-mono text-xs ${className}`}>
      <Link to={to} className="text-primary hover:underline break-all">{truncateHash(hash, prefixLen, suffixLen)}</Link>
      <button
        onClick={copy}
        className="text-muted-foreground transition-colors hover:text-foreground shrink-0"
        title={t('explorer.copyToClipboard')}
        aria-label={t('explorer.copyToClipboard')}
      >
        {copied ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3" />}
      </button>
    </span>
  );
}