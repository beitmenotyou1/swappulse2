import { base44 } from '@/api/base44Client';

// Reliable scanner image upload. Uses the multipart UploadFile integration as
// the primary (and only) path so frames reach the LLM as a public
// media.base44.com URL it can fetch — avoiding the base64-through-function
// layer that fails or truncates on large mobile photos.
export async function uploadScanImage(file) {
  const { file_url } = await base44.integrations.Core.UploadFile({ file });
  if (!file_url) throw new Error('Upload failed');
  return file_url;
}

// Run a single scan against the existing scan-card backend function.
export async function runScan(imageUrl) {
  const res = await base44.functions.invoke('scan-card', { image_url: imageUrl });
  return res?.data || res || {};
}