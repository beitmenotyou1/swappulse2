import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Copy, Check } from 'lucide-react';
import { truncateHash } from '@/lib/explorerFormat';

// Truncated monospace hash with a copy button and a link to a detail page.
export default function HashLink({ hash, to, prefixLen = 10, suffixLen = 8, className = '' }) {
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
        className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
        title="Copy to clipboard"
        aria-label="Copy to clipboard"
      >
        {copied ? <Check className="w-3 h-3 text-success" /> : <Copy className="w-3 h-3" />}
      </button>
    </span>
  );
}