import React from 'react';
import { ExternalLink, Copy, FileText } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

// Renders the contributing AT Protocol records for an achievement. Each URI is
// a clickable link to the firehose explorer (via useFirehoseExplorer) with a
// copy-to-clipboard affordance.
export default function ProofList({ records, generateVerifierLink }) {
  const { toast } = useToast();

  const copy = async (uri) => {
    try {
      await navigator.clipboard.writeText(uri);
      toast({ title: 'AT URI copied', description: uri });
    } catch {
      toast({ title: 'Could not copy', variant: 'destructive' });
    }
  };

  if (!records || records.length === 0) {
    return (
      <p className="text-xs italic text-muted-foreground">No constituent records recorded.</p>
    );
  }

  return (
    <div>
      <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <FileText className="h-3.5 w-3.5" /> Constituent records
      </p>
      <ul className="space-y-1.5">
        {records.map((r, i) => (
          <li key={i}>
            <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-2.5 py-1.5">
              <a
                href={generateVerifierLink(r.uri)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-w-0 items-center gap-1.5 text-left hover:text-primary"
                title={r.uri}
              >
                <span className="truncate font-mono text-xs text-muted-foreground hover:text-primary">{r.uri}</span>
                <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              </a>
              <button
                type="button"
                onClick={() => copy(r.uri)}
                className="ml-auto shrink-0 rounded p-1 text-muted-foreground hover:bg-secondary hover:text-primary"
                aria-label="Copy URI"
              >
                <Copy className="h-3.5 w-3.5" />
              </button>
            </div>
            {r.recordType && (
              <p className="mt-0.5 pl-2.5 text-[10px] uppercase tracking-wide text-muted-foreground">{r.recordType}</p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}