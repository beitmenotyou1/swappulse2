// Podcast RSS feed generator — returns a valid podcast RSS 2.0 + iTunes
// namespace XML document built from a host's published PodcastEpisode
// records, so external podcast apps can subscribe to and distribute the
// host's show. Public endpoint (no auth): podcast apps fetch this URL.
//
// Usage: GET /api/functions/podcast-rss-feed?did=<hostDid>  (or ?handle=<hostHandle>)
// Returns: application/xml
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

function xmlEscape(s: string): string {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function rfc822Date(iso: string): string {
  try {
    return new Date(iso).toUTCString();
  } catch {
    return new Date().toUTCString();
  }
}

function audioMime(url: string): string {
  const u = String(url || '').toLowerCase();
  if (u.endsWith('.mp3')) return 'audio/mpeg';
  if (u.endsWith('.m4a')) return 'audio/x-m4a';
  if (u.endsWith('.webm')) return 'audio/webm';
  if (u.endsWith('.ogg') || u.endsWith('.oga')) return 'audio/ogg';
  if (u.endsWith('.wav')) return 'audio/wav';
  return 'audio/mpeg';
}

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const did = url.searchParams.get('did') || '';
    const handle = (url.searchParams.get('handle') || '').replace(/^@/, '');
    if (!did && !handle) {
      return new Response('Missing did or handle parameter', { status: 400 });
    }

    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole;

    // Resolve episodes by host did (preferred) or host_handle fallback.
    let episodes: any[] = [];
    if (did) {
      episodes = await svc.entities.PodcastEpisode.filter({ did }, '-published_at', 200).catch(() => []);
    }
    if (episodes.length === 0 && handle) {
      const all = await svc.entities.PodcastEpisode.list('-published_at', 500).catch(() => []);
      episodes = all.filter((e: any) => (e.host_handle || '').toLowerCase() === handle.toLowerCase());
    }

    if (episodes.length === 0) {
      return new Response('No episodes found for this host', { status: 404, headers: { 'Content-Type': 'text/plain' } });
    }

    // Derive show metadata from the most recent episode's host fields.
    const latest = episodes[0];
    const showTitle = `${latest.host_name || latest.host_handle || 'Collector'}'s Podcast`;
    const showDesc = 'Recorded voice spaces and podcasts from SwapPulse collectors.';
    const hostName = latest.host_name || latest.host_handle || 'SwapPulse Collector';
    const baseAppUrl = (url.searchParams.get('base') || `https://${url.host}`).replace(/\/$/, '');

    const items = episodes.map((ep: any) => {
      const audioUrl = xmlEscape(ep.audio_url || '');
      const mime = audioMime(ep.audio_url || '');
      const duration = Number(ep.duration_seconds || 0);
      const guid = ep.at_uri || ep.id || `${baseAppUrl}/podcast/${ep.id}`;
      const pubDate = rfc822Date(ep.published_at || ep.created_date);
      const chapters = Array.isArray(ep.chapter_marks) && ep.chapter_marks.length
        ? `        <psc:chapters version="1.2" xmlns:psc="http://podlove.org/simple-chapters/">\n` +
          ep.chapter_marks.map((c: any) => `          <psc:chapter start="${Number(c.timestamp_seconds || 0)}" title="${xmlEscape(c.title || '')}"/>\n`).join('') +
          `        </psc:chapters>\n`
        : '';
      return `      <item>
        <title>${xmlEscape(ep.title || '')}</title>
        <description>${xmlEscape(ep.description || '')}</description>
        <pubDate>${pubDate}</pubDate>
        <guid isPermaLink="false">${xmlEscape(guid)}</guid>
        <enclosure url="${audioUrl}" length="${duration * 128 * 1024}" type="${mime}"/>
        <itunes:duration>${duration}</itunes:duration>
        <itunes:summary>${xmlEscape(ep.show_notes || ep.description || '')}</itunes:summary>
        ${ep.cover_image_url ? `<itunes:image href="${xmlEscape(ep.cover_image_url)}"/>\n` : ''}${chapters}      </item>`;
    }).join('\n');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>${xmlEscape(showTitle)}</title>
    <link>${xmlEscape(baseAppUrl)}</link>
    <description>${xmlEscape(showDesc)}</description>
    <language>en-us</language>
    <itunes:author>${xmlEscape(hostName)}</itunes:author>
    <itunes:summary>${xmlEscape(showDesc)}</itunes:summary>
    <itunes:category text="Leisure"/>
    <itunes:explicit>false</itunes:explicit>
${items}
  </channel>
</rss>`;

    return new Response(xml, {
      status: 200,
      headers: {
        'Content-Type': 'application/rss+xml; charset=utf-8',
        'Cache-Control': 'public, max-age=300',
      },
    });
  } catch (error) {
    console.error('podcast-rss-feed error', error?.message || error);
    return new Response('Failed to generate feed', { status: 500, headers: { 'Content-Type': 'text/plain' } });
  }
});