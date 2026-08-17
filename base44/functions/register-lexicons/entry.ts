// register-lexicons — publishes every org.swappulse.* lexicon definition to the
// network via com.atproto.lexicon.schema so the AppView indexes the custom
// collections and SwapPulse records become discoverable on bsky.app.
//
// Uses the shared PDS session (PDS_URL, PDS_IDENTIFIER, PDS_APP_PASSWORD).
// Idempotent: putRecord by NSID rkey, so re-running after a lexicon edit just
// updates the definition in place. Invoked by the Register Lexicons workflow
// (one-time / on-demand after lexicon edits).

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { getPdsSession, pdsRequest, clearPdsSession } from '../../shared/pdsSession.ts';
import { LEXICONS } from '../../shared/lexiconRegistry.ts';

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const caller = await base44.auth.me().catch(() => null);
    if (!caller || caller.role !== 'admin') {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }
    const { pdsUrl, session } = await getPdsSession();
    const results: any[] = [];
    let ok = 0, failed = 0;

    for (const lex of LEXICONS) {
      const nsid = lex.id;
      const record = { ...lex, $type: 'com.atproto.lexicon.schema' };
      try {
        let res: any = await pdsRequest(
          pdsUrl, session.accessJwt, 'com.atproto.repo.putRecord',
          { repo: session.did, collection: 'com.atproto.lexicon.schema', rkey: nsid, record },
        );
        if (res?.error && res.status === 401) {
          clearPdsSession();
          const fresh = await getPdsSession();
          res = await pdsRequest(
            fresh.pdsUrl, fresh.session.accessJwt, 'com.atproto.repo.putRecord',
            { repo: fresh.session.did, collection: 'com.atproto.lexicon.schema', rkey: nsid, record },
          );
        }
        if (res?.error) {
          failed++;
          results.push({ nsid, ok: false, error: `putRecord failed (${res.status})` });
          console.error('register-lexicons: putRecord failed for', nsid, res.status, res.body);
        } else {
          ok++;
          results.push({ nsid, ok: true, uri: res.uri });
        }
      } catch (e: any) {
        failed++;
        results.push({ nsid, ok: false, error: e?.message || 'Unknown error' });
        console.error('register-lexicons: error for', nsid, e?.message || e);
      }
    }

    return Response.json({ registered: ok, failed, total: LEXICONS.length, results });
  } catch (error) {
    console.error('register-lexicons error:', error?.message || error);
    return Response.json({ error: error?.message || 'Unknown error' }, { status: 500 });
  }
}