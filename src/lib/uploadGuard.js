const MB = 1024 * 1024;

function ensureFile(file) {
  if (!file || typeof file.size !== 'number') throw new Error('Choose a valid file.');
}

export function assertImageUpload(file, maxMB = 10) {
  ensureFile(file);
  const type = String(file.type || '').toLowerCase();
  if (!type.startsWith('image/') || type === 'image/svg+xml') {
    throw new Error('Choose a JPEG, PNG, WebP, GIF or other standard image file. SVG files are not accepted.');
  }
  if (file.size > maxMB * MB) throw new Error(`Image is too large. Maximum size is ${maxMB} MB.`);
  return file;
}

export function assertStoryMediaUpload(file) {
  ensureFile(file);
  const type = String(file.type || '').toLowerCase();
  if (type.startsWith('image/')) return assertImageUpload(file, 10);
  if (!type.startsWith('video/')) throw new Error('Choose an image or video file.');
  if (file.size > 50 * MB) throw new Error('Video is too large. Maximum size is 50 MB.');
  return file;
}

export function assertPodcastMediaUpload(file, maxMB = 500) {
  ensureFile(file);
  const type = String(file.type || '').toLowerCase();
  if (!type.startsWith('audio/') && !type.startsWith('video/')) {
    throw new Error('Choose an audio or video recording.');
  }
  if (file.size > maxMB * MB) throw new Error(`Recording is too large. Maximum size is ${maxMB} MB.`);
  return file;
}

export function assertCollectionImport(file, maxMB = 10) {
  ensureFile(file);
  const ext = String(file.name || '').split('.').pop()?.toLowerCase();
  if (!['csv', 'json', 'xml'].includes(ext)) throw new Error('Choose a CSV, JSON or XML file.');
  if (file.size > maxMB * MB) throw new Error(`Import file is too large. Maximum size is ${maxMB} MB.`);
  return file;
}
