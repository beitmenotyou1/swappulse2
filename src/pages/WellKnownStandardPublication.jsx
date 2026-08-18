import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';

// Public route that serves the SwapPulse site.standard.publication at:// URI
// as plain text, so external Standard.site verifiers can confirm the
// publication record belongs to the swappulse.org domain.
//
// Modeled on SitemapXml — renders the URI in a <pre> tag. External verifiers
// that execute JavaScript will see the URI; those that don't can use the
// <link rel="site.standard.document"> tags on individual content pages.
export default function WellKnownStandardPublication() {
  const [uri, setUri] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const rows = await base44.entities.StandardSiteConfig.list('-created_date', 1);
        if (alive) setUri(rows?.[0]?.publication_uri || '');
      } catch (e) {
        if (alive) setError(e.message || 'Failed to load publication URI');
      }
    })();
    return () => { alive = false; };
  }, []);

  if (error) return <pre style={{ whiteSpace: 'pre-wrap' }}>{error}</pre>;
  if (!uri) return null;
  return <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>{uri}</pre>;
}