// Frontend helper for PDS blob storage. Uploads user media to the AT Protocol
// PDS as a real blob (com.atproto.repo.uploadBlob) via the pds-blob-upload
// backend function, returning a portable at://-served URL. Falls back to the
// external UploadFile integration if the PDS is unreachable so uploads never
// hard-fail the UX.
//
// Use uploadMedia(file) for any user-content image (avatars, story media,
// binder covers, etc.) — it prefers PDS storage and degrades gracefully.

import { base44 } from '@/api/base44Client';
import { assertImageUpload } from '@/lib/uploadGuard';

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

export async function uploadPdsBlob(file) {
  assertImageUpload(file);
  const base64 = await fileToBase64(file);
  const res = await base44.functions.invoke('pds-blob-upload', {
    mimeType: file.type || 'application/octet-stream',
    base64,
  });
  const data = res?.data || res;
  if (!data?.blobUrl) throw new Error(data?.error || 'PDS blob upload failed');
  return data.blobUrl;
}

// Preferred entry point: PDS blob first, external UploadFile as a fallback.
export async function uploadMedia(file) {
  assertImageUpload(file);
  try {
    return await uploadPdsBlob(file);
  } catch (e) {
    console.warn('pdsBlob: PDS upload failed, falling back to external storage', e?.message || e);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    return file_url;
  }
}