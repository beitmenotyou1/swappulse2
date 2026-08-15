import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';

// Public route that serves robots.txt by calling the seo-robots backend
// function and rendering the raw text.
export default function RobotsTxt() {
  const [text, setText] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await base44.functions.invoke('seo-robots', {});
        const body = res?.data ?? res;
        if (alive) setText(typeof body === 'string' ? body : body?.text || '');
      } catch (e) {
        if (alive) setError(e.message || 'Failed to generate robots.txt');
      }
    })();
    return () => { alive = false; };
  }, []);

  if (error) return <pre style={{ whiteSpace: 'pre-wrap' }}>{error}</pre>;
  if (!text) return null;
  return <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>{text}</pre>;
}