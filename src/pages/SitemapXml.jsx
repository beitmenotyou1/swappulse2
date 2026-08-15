import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';

// Public route that serves the sitemap XML by calling the seo-sitemap backend
// function and rendering the raw XML with the correct content type.
export default function SitemapXml() {
  const [xml, setXml] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await base44.functions.invoke('seo-sitemap', {});
        const body = res?.data ?? res;
        const text = typeof body === 'string' ? body : body?.xml || '';
        if (alive) setXml(text);
      } catch (e) {
        if (alive) setError(e.message || 'Failed to generate sitemap');
      }
    })();
    return () => { alive = false; };
  }, []);

  if (error) return <pre style={{ whiteSpace: 'pre-wrap' }}>{error}</pre>;
  if (!xml) return null;
  return <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>{xml}</pre>;
}