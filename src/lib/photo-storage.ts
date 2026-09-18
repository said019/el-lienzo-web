import { createHash, randomUUID } from 'node:crypto';

// Public promotion photos only. Historical volume files remain readable.
const MAX_BYTES = 10 * 1024 * 1024;
const MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'];

function config() {
  const clientId = process.env.PHOTOS_DRIVE_CLIENT_ID;
  const clientSecret = process.env.PHOTOS_DRIVE_CLIENT_SECRET;
  const refreshToken = process.env.PHOTOS_DRIVE_REFRESH_TOKEN;
  const folderId = process.env.PHOTOS_DRIVE_FOLDER_ID;
  if (!clientId || !clientSecret || !refreshToken || !folderId) {
    throw new Error('Photo storage is not configured');
  }
  return { clientId, clientSecret, refreshToken, folderId };
}

async function checked(response: Response, operation: string) {
  if (!response.ok) throw new Error(`${operation} failed (${response.status})`);
  return response;
}

export async function uploadPhoto(buffer: Buffer, mime: string): Promise<string> {
  if (!MIMES.includes(mime) || !buffer.length || buffer.length > MAX_BYTES) {
    throw new Error('Invalid photo format or size');
  }
  const c = config();
  const tokenResponse = await checked(await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', signal: AbortSignal.timeout(15000),
    body: new URLSearchParams({ client_id: c.clientId, client_secret: c.clientSecret,
      refresh_token: c.refreshToken, grant_type: 'refresh_token' }),
  }), 'Photo authorization');
  const { access_token: token } = await tokenResponse.json() as { access_token?: string };
  if (!token) throw new Error('Photo authorization failed');
  const initialized = await checked(await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,md5Checksum,size', {
    method: 'POST', signal: AbortSignal.timeout(15000),
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'X-Upload-Content-Type': mime, 'X-Upload-Content-Length': String(buffer.length) },
    body: JSON.stringify({name:`promotion-${randomUUID()}.webp`,parents:[c.folderId]}),
  }), 'Photo upload initialization');
  const location = initialized.headers.get('location');
  if (!location || new URL(location).origin !== 'https://www.googleapis.com') throw new Error('Invalid upload location');
  const uploaded = await checked(await fetch(location, {
    method: 'PUT', signal: AbortSignal.timeout(60000),
    headers: { 'Content-Type': mime, 'Content-Length': String(buffer.length) },
    body: new Uint8Array(buffer),
  }), 'Photo upload');
  const file = await uploaded.json() as { id: string; md5Checksum: string; size: string };
  if (!file.id) throw new Error('Photo upload returned no file');
  try {
    if (file.md5Checksum !== createHash('md5').update(buffer).digest('hex') || Number(file.size) !== buffer.length) {
      throw new Error('Photo integrity check failed');
    }
    await checked(await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}/permissions`, {
      method: 'POST', signal: AbortSignal.timeout(15000),
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'anyone', role: 'reader' }),
    }), 'Photo access');
    return `https://lh3.googleusercontent.com/d/${file.id}=w1600`;
  } catch (error) {
    await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}`, {
      method: 'DELETE', signal: AbortSignal.timeout(15000), headers: { Authorization: `Bearer ${token}` },
    }).catch(() => undefined);
    throw error;
  }
}
