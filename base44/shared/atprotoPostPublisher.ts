import { attachRichTextFacets } from './hashtagFacets.ts';
import {
  clearPdsSession,
  getPdsSessionForUser,
  pdsRequest,
} from './pdsSession.ts';
import { getUserIdentity } from './userIdentity.ts';

const MAX_IMAGE_BYTES = 1_000_000;
const IMAGE_HOSTS = new Set([
  'assets.tcgdex.net',
  'base44.app',
  'media.base44.com',
  'media.base44static.com',
  'static.wixstatic.com',
]);

export type DeliverySource = 'manual' | 'retry';

export class AtprotoPublishError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'AtprotoPublishError';
    this.code = code;
  }
}

function safeFailure(error: any): { code: string; message: string } {
  if (error instanceof AtprotoPublishError) {
    return { code: error.code, message: error.message.slice(0, 300) };
  }
  const raw = String(error?.message || error || '');
  if (/credential|app password|identity.*not linked/i.test(raw)) {
    return {
      code: 'AT_CREDENTIALS_MISSING',
      message: 'Reconnect this AT Protocol account in Settings, then retry.',
    };
  }
  if (/createSession.*\((400|401|403)\)|authentication/i.test(raw)) {
    return {
      code: 'AT_AUTHENTICATION_FAILED',
      message: 'The stored AT Protocol app password is no longer accepted. Reconnect the account in Settings.',
    };
  }
  if (/identity mismatch/i.test(raw)) {
    return {
      code: 'AT_IDENTITY_MISMATCH',
      message: 'The PDS session does not match this SwapPulse account.',
    };
  }
  if (/abort|timed out|network|fetch failed|unreachable/i.test(raw)) {
    return {
      code: 'AT_PDS_UNREACHABLE',
      message: 'The Personal Data Server could not be reached. SwapPulse will retry automatically.',
    };
  }
  return {
    code: 'AT_PUBLICATION_FAILED',
    message: 'BlueSky publication failed. SwapPulse will retry automatically.',
  };
}

function trimPostText(value: any): string {
  const text = String(value || '').trim();
  if (!text) return 'New SwapPulse post';
  try {
    const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
    return Array.from(segmenter.segment(text), (entry: any) => entry.segment)
      .slice(0, 300)
      .join('');
  } catch {
    return Array.from(text).slice(0, 300).join('');
  }
}

function stableRkey(post: any, did: string): string {
  const reserved = String(post?.federation_rkey || '')
    .replace(/[^A-Za-z0-9._~:-]/g, '')
    .slice(0, 512);
  if (reserved) return reserved;
  const uri = String(post?.at_uri || '');
  const match = uri.match(/^at:\/\/([^/]+)\/app\.bsky\.feed\.post\/([^/]+)$/);
  if (match && match[1] === did) return match[2];
  const safeId = String(post?.id || '')
    .replace(/[^A-Za-z0-9._~:-]/g, '')
    .slice(0, 480);
  if (!safeId) throw new AtprotoPublishError('AT_RECORD_KEY_INVALID', 'The post is missing a stable publication key.');
  return `sp${safeId}`;
}

function validStrongRef(uri: any, cid: any) {
  return typeof uri === 'string'
    && uri.startsWith('at://')
    && typeof cid === 'string'
    && cid.length > 0;
}

function safeExternalUrl(value: any): string {
  try {
    const url = new URL(String(value || ''));
    return url.protocol === 'https:' ? url.toString() : '';
  } catch {
    return '';
  }
}

function imageMimeFromUrl(url: URL): string {
  const path = url.pathname.toLowerCase();
  if (path.endsWith('.png')) return 'image/png';
  if (path.endsWith('.webp')) return 'image/webp';
  return 'image/jpeg';
}

async function fetchWithTimeout(url: string, init: RequestInit = {}, timeoutMs = 15_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchAllowedImage(rawUrl: string): Promise<{ bytes: Uint8Array; mimeType: string }> {
  let current = new URL(rawUrl);
  for (let redirects = 0; redirects <= 2; redirects += 1) {
    if (current.protocol !== 'https:' || !IMAGE_HOSTS.has(current.hostname.toLowerCase())) {
      throw new AtprotoPublishError('AT_MEDIA_HOST_NOT_ALLOWED', 'An attached image is hosted on an unsupported domain.');
    }
    const response = await fetchWithTimeout(current.toString(), { redirect: 'manual' });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location || redirects === 2) {
        throw new AtprotoPublishError('AT_MEDIA_REDIRECT_FAILED', 'An attached image could not be fetched safely.');
      }
      current = new URL(location, current);
      continue;
    }
    if (!response.ok) {
      throw new AtprotoPublishError('AT_MEDIA_FETCH_FAILED', 'An attached image could not be fetched.');
    }
    const declaredSize = Number(response.headers.get('content-length') || 0);
    if (declaredSize > MAX_IMAGE_BYTES) {
      throw new AtprotoPublishError('AT_MEDIA_TOO_LARGE', 'An attached image is larger than the BlueSky upload limit.');
    }
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength === 0 || bytes.byteLength > MAX_IMAGE_BYTES) {
      throw new AtprotoPublishError('AT_MEDIA_TOO_LARGE', 'An attached image is empty or larger than the BlueSky upload limit.');
    }
    const headerMime = String(response.headers.get('content-type') || '').split(';')[0].toLowerCase();
    const mimeType = headerMime.startsWith('image/') ? headerMime : imageMimeFromUrl(current);
    return { bytes, mimeType };
  }
  throw new AtprotoPublishError('AT_MEDIA_FETCH_FAILED', 'An attached image could not be fetched.');
}

async function uploadImage(
  pdsUrl: string,
  accessJwt: string,
  imageUrl: string,
): Promise<any> {
  const { bytes, mimeType } = await fetchAllowedImage(imageUrl);
  const response = await fetchWithTimeout(
    `${pdsUrl}/xrpc/com.atproto.repo.uploadBlob`,
    {
      method: 'POST',
      headers: {
        'Content-Type': mimeType,
        'Authorization': `Bearer ${accessJwt}`,
      },
      body: bytes,
    },
  );
  if (!response.ok) {
    throw new AtprotoPublishError('AT_MEDIA_UPLOAD_FAILED', 'BlueSky rejected an attached image.');
  }
  const body = await response.json();
  if (!body?.blob) {
    throw new AtprotoPublishError('AT_MEDIA_UPLOAD_FAILED', 'BlueSky did not return an image reference.');
  }
  return body.blob;
}

async function buildEmbed(post: any, pdsUrl: string, accessJwt: string): Promise<any | undefined> {
  const images = Array.isArray(post?.embed_images) ? post.embed_images.slice(0, 4) : [];
  if (images.length > 0) {
    const uploaded: any[] = [];
    for (const image of images) {
      const url = safeExternalUrl(typeof image === 'string' ? image : image?.url);
      if (!url) continue;
      try {
        const blob = await uploadImage(pdsUrl, accessJwt, url);
        uploaded.push({
          image: blob,
          alt: typeof image === 'object' ? String(image?.alt || '').slice(0, 1000) : '',
        });
      } catch (error) {
        console.error('atprotoPostPublisher: image upload omitted', safeFailure(error).code);
      }
    }
    if (uploaded.length > 0) {
      return { $type: 'app.bsky.embed.images', images: uploaded };
    }
  }

  const cardId = String(post?.card_id || '').trim();
  const external = post?.embed_external || {};
  const video = post?.embed_video || {};
  const uri = cardId
    ? `https://swappulse.org/card/${encodeURIComponent(cardId)}`
    : safeExternalUrl(external?.uri || video?.url);
  if (!uri) return undefined;

  let thumb: any;
  const thumbUrl = safeExternalUrl(
    cardId ? post?.card_image : (external?.thumb || video?.thumbnail),
  );
  if (thumbUrl) {
    try {
      thumb = await uploadImage(pdsUrl, accessJwt, thumbUrl);
    } catch (error) {
      console.error('atprotoPostPublisher: external thumbnail omitted', safeFailure(error).code);
    }
  }

  return {
    $type: 'app.bsky.embed.external',
    external: {
      uri,
      title: String(
        cardId
          ? (post?.card_name || 'Pokémon card on SwapPulse')
          : (external?.title || video?.platform || 'SwapPulse link'),
      ).slice(0, 300),
      description: String(
        cardId
          ? [post?.set_name, post?.card_rarity].filter(Boolean).join(' | ')
          : (external?.description || 'Shared from SwapPulse'),
      ).slice(0, 1000),
      ...(thumb ? { thumb } : {}),
    },
  };
}

async function readExistingRecord(
  pdsUrl: string,
  accessJwt: string,
  did: string,
  rkey: string,
) {
  const url = new URL(`${pdsUrl}/xrpc/com.atproto.repo.getRecord`);
  url.searchParams.set('repo', did);
  url.searchParams.set('collection', 'app.bsky.feed.post');
  url.searchParams.set('rkey', rkey);
  const response = await fetchWithTimeout(url.toString(), {
    headers: { Authorization: `Bearer ${accessJwt}` },
    redirect: 'error',
  });
  if (response.status === 400 || response.status === 404) return null;
  if (!response.ok) {
    throw new AtprotoPublishError('AT_PDS_UNREACHABLE', 'The Personal Data Server could not confirm the post record.');
  }
  return response.json();
}

async function recordDeliveryEvent(svc: any, data: any) {
  await svc.entities.AtprotoDeliveryEvent.create({
    ...data,
    message: String(data?.message || '').slice(0, 300),
    attempted_at: new Date().toISOString(),
  }).catch((error: any) => {
    console.error('atprotoPostPublisher: delivery audit write failed', error?.message || error);
  });
}

export async function publishLocalPost(
  svc: any,
  user: any,
  post: any,
  source: DeliverySource = 'manual',
) {
  const attemptedAt = new Date().toISOString();
  const attempts = Number(post?.federation_attempts || 0) + 1;

  try {
    if (post?.visibility_scope !== 'public') {
      throw new AtprotoPublishError('AT_POST_NOT_PUBLIC', 'Only public posts can be published to the AT Protocol.');
    }
    if (!user || user.id !== post.created_by_id) {
      throw new AtprotoPublishError('AT_POST_OWNER_MISMATCH', 'The post owner could not be verified.');
    }
    const identity = await getUserIdentity(svc, user);
    if (!identity) {
      throw new AtprotoPublishError(
        'AT_CREDENTIALS_MISSING',
        'Reconnect this AT Protocol account in Settings, then retry.',
      );
    }
    if (post.did && post.did !== identity.did) {
      throw new AtprotoPublishError('AT_IDENTITY_MISMATCH', 'The post identity does not match the linked AT Protocol account.');
    }

    let resolved = await getPdsSessionForUser(identity.pdsUrl, identity.did, identity.appPassword);
    if (resolved.session.did !== identity.did) {
      throw new AtprotoPublishError('AT_IDENTITY_MISMATCH', 'The PDS session does not match this SwapPulse account.');
    }

    const rkey = stableRkey(post, identity.did);
    const text = trimPostText(post?.content || post?.card_name);
    const record: any = {
      $type: 'app.bsky.feed.post',
      text,
      createdAt: post?.original_created_at || post?.created_date || attemptedAt,
      langs: [String(post?.language || user?.locale || 'en-GB').slice(0, 35)],
    };
    const tags = Array.from(new Set(
      [...(post?.canonical_tags || []), ...(post?.hashtags || [])]
        .map((tag: any) => String(tag || '').replace(/^#/, '').trim())
        .filter(Boolean)
        .map((tag: string) => Array.from(tag).slice(0, 64).join('')),
    )).slice(0, 8);
    if (tags.length > 0) record.tags = tags;
    if (
      validStrongRef(post?.root_uri, post?.root_cid)
      && validStrongRef(post?.parent_uri, post?.parent_cid)
    ) {
      record.reply = {
        root: { uri: post.root_uri, cid: post.root_cid },
        parent: { uri: post.parent_uri, cid: post.parent_cid },
      };
    }
    const embed = await buildEmbed(post, resolved.pdsUrl, resolved.session.accessJwt);
    if (embed) record.embed = embed;
    attachRichTextFacets(record);

    let existing = await readExistingRecord(
      resolved.pdsUrl,
      resolved.session.accessJwt,
      identity.did,
      rkey,
    ).catch(() => null);
    let result: any;
    if (existing?.uri) {
      if (existing?.value?.text !== record.text) {
        throw new AtprotoPublishError('AT_RECORD_KEY_CONFLICT', 'The stable BlueSky record key is already in use.');
      }
      result = { uri: existing.uri, cid: existing.cid, already: true };
    } else {
      result = await pdsRequest(
        resolved.pdsUrl,
        resolved.session.accessJwt,
        'com.atproto.repo.createRecord',
        {
          repo: identity.did,
          collection: 'app.bsky.feed.post',
          rkey,
          record,
        },
      );
      if (result?.error && result.status === 401) {
        clearPdsSession();
        resolved = await getPdsSessionForUser(identity.pdsUrl, identity.did, identity.appPassword);
        result = await pdsRequest(
          resolved.pdsUrl,
          resolved.session.accessJwt,
          'com.atproto.repo.createRecord',
          {
            repo: identity.did,
            collection: 'app.bsky.feed.post',
            rkey,
            record,
          },
        );
      }
      if (result?.error) {
        throw new AtprotoPublishError(
          result.status === 401 ? 'AT_AUTHENTICATION_FAILED' : 'AT_PUBLICATION_FAILED',
          result.status === 401
            ? 'The stored AT Protocol app password is no longer accepted. Reconnect the account in Settings.'
            : 'BlueSky publication failed. SwapPulse will retry automatically.',
        );
      }
    }

    await svc.entities.Post.update(post.id, {
      at_uri: result.uri,
      cid: result.cid || '',
      did: identity.did,
      bridged: true,
      federation_status: 'published',
      federation_rkey: rkey,
      federation_attempts: attempts,
      federation_last_attempt_at: attemptedAt,
      federation_published_at: new Date().toISOString(),
      federation_error_code: '',
      federation_error_message: '',
    });
    await recordDeliveryEvent(svc, {
      source,
      user_id: user.id,
      post_id: post.id,
      did: identity.did,
      outcome: result.already ? 'already_published' : 'published',
      at_uri: result.uri,
      facet_count: Array.isArray(record.facets) ? record.facets.length : 0,
      tag_count: Array.isArray(record.tags) ? record.tags.length : 0,
    });
    return {
      ok: true,
      already: !!result.already,
      uri: result.uri,
      cid: result.cid || '',
      did: identity.did,
      rkey,
      facets: Array.isArray(record.facets) ? record.facets.length : 0,
      tags: Array.isArray(record.tags) ? record.tags.length : 0,
    };
  } catch (error) {
    const failure = safeFailure(error);
    await svc.entities.Post.update(post.id, {
      bridged: false,
      federation_status: 'failed',
      federation_attempts: attempts,
      federation_last_attempt_at: attemptedAt,
      federation_error_code: failure.code,
      federation_error_message: failure.message,
    }).catch(() => {});
    await recordDeliveryEvent(svc, {
      source,
      user_id: user?.id || '',
      post_id: post?.id || '',
      did: post?.did || user?.did || '',
      outcome: 'failed',
      error_code: failure.code,
      message: failure.message,
      facet_count: 0,
      tag_count: 0,
    });
    throw new AtprotoPublishError(failure.code, failure.message);
  }
}
