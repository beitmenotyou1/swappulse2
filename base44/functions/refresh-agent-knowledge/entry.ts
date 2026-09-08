import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

const REPO_OWNER = 'beitmenotyou1';
const REPO_NAME = 'swappulse2';
const MAX_FETCH_BYTES = 60000;
const MAX_PUBLISHABLE_CHARS = 20000;

const SOURCE_DOCUMENTS = [
  {
    documentKey: 'swappulse-project-architecture',
    title: 'SwapPulse project architecture',
    path: 'docs/developers/project-architecture.md',
    sourceUrl: 'https://swappulse.gitbook.io/swappulse-docs/developers/swappulse-project-architecture',
    tags: ['project', 'architecture', 'security'],
  },
  {
    documentKey: 'swappulse-collection-workflow',
    title: 'SwapPulse collection workflow',
    path: 'docs/collection-and-catalogue/collection.md',
    sourceUrl: 'https://swappulse.gitbook.io/swappulse-docs/collection-and-catalogue/collection',
    tags: ['collection', 'catalogue'],
  },
  {
    documentKey: 'swappulse-card-attestations',
    title: 'Card possession attestations',
    path: 'docs/wallet-and-on-chain/card-attestations.md',
    sourceUrl: 'https://swappulse.gitbook.io/swappulse-docs/wallet-and-on-chain/card-attestations',
    tags: ['cards', 'attestations', 'wallet'],
  },
  {
    documentKey: 'swappulse-ai-assistant-boundary',
    title: 'SwapPulse Collector Copilot boundary',
    path: 'docs/ai-assistants/collector-copilot.md',
    sourceUrl: 'https://swappulse.gitbook.io/swappulse-docs/ai-assistants/collector-copilot',
    tags: ['ai', 'copilot', 'safety'],
  },
  {
    documentKey: 'swappulse-data-authorities',
    title: 'SwapPulse Pokémon data authority map',
    path: 'docs/apis/third-party-apis/pokemon-data-and-market-apis.md',
    sourceUrl: 'https://swappulse.gitbook.io/swappulse-docs/apis/third-party-apis/pokemon-data-and-market-apis',
    tags: ['pokemon', 'tcgdex', 'pricing', 'sources'],
  },
  {
    documentKey: 'swappulse-stage-d-baseline',
    title: 'Stage D operational baseline',
    path: 'docs/network-and-web3/stage-d-operations.md',
    sourceUrl: 'https://swappulse.gitbook.io/swappulse-docs/network-and-web3/stage-d-operations',
    tags: ['chain', 'stage-d', 'operations'],
  },
];

const SUSPICIOUS_PATTERNS = [
  {
    reason: 'instruction_override_language',
    pattern: /ignore\s+(?:all\s+|any\s+)?(?:previous|prior|system|developer)\s+(?:instructions?|messages?|prompts?)/i,
  },
  {
    reason: 'prompt_boundary_language',
    pattern: /(?:system|developer)\s+(?:message|prompt)\s*:/i,
  },
  {
    reason: 'secret_extraction_language',
    pattern: /(?:reveal|print|return|exfiltrate).{0,80}(?:secret|credential|private[_ -]?key|seed phrase|password|api[_ -]?key|access token)/i,
  },
  {
    reason: 'active_content_marker',
    pattern: /<script\b|javascript\s*:/i,
  },
  {
    reason: 'tool_call_marker',
    pattern: /(?:tool|function)[_ -]?call\s*[:=]/i,
  },
];

function normaliseContent(value: string): string {
  return value
    .normalize('NFKC')
    .replace(/\r\n?/g, '\n')
    .replace(/\u0000/g, '')
    .trim();
}

function safetyReasons(content: string): string[] {
  const reasons = SUSPICIOUS_PATTERNS
    .filter(({ pattern }) => pattern.test(content))
    .map(({ reason }) => reason);

  if (content.length > MAX_PUBLISHABLE_CHARS) {
    reasons.push('content_exceeds_publish_limit');
  }

  return [...new Set(reasons)];
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

async function fetchGitHubHead(): Promise<string> {
  const response = await fetch(
    'https://api.github.com/repos/' + REPO_OWNER + '/' + REPO_NAME + '/commits/main',
    {
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'SwapPulse-Collector-Copilot-Knowledge-Refresh',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    },
  );

  if (!response.ok) {
    throw new Error('GitHub head lookup failed with status ' + response.status);
  }

  const payload = await response.json();
  const revision = String(payload?.sha || '').toLowerCase();

  if (!/^[0-9a-f]{40}$/.test(revision)) {
    throw new Error('GitHub returned an invalid main revision');
  }

  return revision;
}

async function fetchAllowlistedFile(
  revision: string,
  path: string,
): Promise<string> {
  const rawUrl =
    'https://raw.githubusercontent.com/' +
    REPO_OWNER +
    '/' +
    REPO_NAME +
    '/' +
    revision +
    '/' +
    path;

  const response = await fetch(rawUrl, {
    headers: {
      Accept: 'text/plain',
      'User-Agent': 'SwapPulse-Collector-Copilot-Knowledge-Refresh',
    },
  });

  if (!response.ok) {
    throw new Error(path + ' fetch failed with status ' + response.status);
  }

  const lengthHeader = Number(response.headers.get('content-length') || 0);
  if (lengthHeader > MAX_FETCH_BYTES) {
    throw new Error(path + ' exceeds the fetch size limit');
  }

  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > MAX_FETCH_BYTES) {
    throw new Error(path + ' exceeds the fetch size limit');
  }

  const content = normaliseContent(new TextDecoder().decode(bytes));
  if (content.length < 20) {
    throw new Error(path + ' returned empty or implausibly short content');
  }

  return content;
}

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const caller = await base44.auth.me().catch(() => null);

    if (!caller) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (caller.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const svc = base44.asServiceRole;
    const revision = await fetchGitHubHead();
    const fetchedAt = new Date().toISOString();
    const queued = [];
    const skipped = [];
    const errors = [];

    for (const source of SOURCE_DOCUMENTS) {
      try {
        const content = await fetchAllowlistedFile(revision, source.path);
        const contentHash = await sha256(content);

        const [publishedRows, pendingRows] = await Promise.all([
          svc.entities.AgentKnowledgeDocument.filter(
            {
              document_key: source.documentKey,
              status: 'approved',
            },
            '-reviewed_at',
            20,
          ).catch(() => []),
          svc.entities.AgentKnowledgeRevision.filter(
            {
              document_key: source.documentKey,
              review_status: 'pending_review',
            },
            '-fetched_at',
            100,
          ).catch(() => []),
        ]);

        const published = publishedRows[0] || null;
        const publishedHash = published?.content_hash ||
          (published?.content
            ? await sha256(normaliseContent(String(published.content)))
            : '');

        if (publishedHash === contentHash) {
          skipped.push({
            document_key: source.documentKey,
            reason: 'published_content_unchanged',
          });
          continue;
        }

        if (pendingRows.some((row: any) => row.content_hash === contentHash)) {
          skipped.push({
            document_key: source.documentKey,
            reason: 'already_waiting_for_review',
          });
          continue;
        }

        const reasons = safetyReasons(content);
        const record: Record<string, unknown> = {
          document_key: source.documentKey,
          title: source.title,
          content,
          source_type: 'github',
          source_url: source.sourceUrl,
          source_revision: revision,
          content_hash: contentHash,
          authority: 'project',
          locale: 'en',
          tags: source.tags,
          review_status: 'pending_review',
          safety_status: reasons.length > 0 ? 'flagged' : 'passed',
          safety_reasons: reasons,
          fetched_at: fetchedAt,
        };

        if (publishedHash) {
          record.previous_hash = publishedHash;
        }

        const created =
          await svc.entities.AgentKnowledgeRevision.create(record);

        queued.push({
          id: created.id,
          document_key: source.documentKey,
          safety_status: created.safety_status,
          safety_reasons: created.safety_reasons || [],
        });
      } catch (sourceError: any) {
        console.error(
          'refresh-agent-knowledge source error',
          source.path,
          sourceError?.message || sourceError,
        );
        errors.push({
          document_key: source.documentKey,
          path: source.path,
          error: sourceError?.message || 'Source refresh failed',
        });
      }
    }

    return Response.json({
      ok: errors.length === 0,
      source_revision: revision,
      fetched_at: fetchedAt,
      queued_count: queued.length,
      skipped_count: skipped.length,
      error_count: errors.length,
      queued,
      skipped,
      errors,
      publication_changed: false,
      review_required: true,
    });
  } catch (error: any) {
    console.error(
      'refresh-agent-knowledge error',
      error?.message || error,
    );
    return Response.json(
      { error: error?.message || 'Knowledge refresh failed' },
      { status: 500 },
    );
  }
}
