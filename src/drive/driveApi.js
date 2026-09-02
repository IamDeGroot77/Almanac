// Google Drive app-data folder: a private file only this app can see.
// Reference: https://developers.google.com/drive/api/guides/appdata

const FILES = 'https://www.googleapis.com/drive/v3/files';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files';
export const STATE_FILE = 'almanac-state.json';

export class DriveApiError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'DriveApiError';
    this.status = status;
  }
}

async function check(res, what) {
  if (res.ok) return res;
  let message = `${what} failed (${res.status})`;
  try {
    const data = await res.json();
    if (data?.error?.message) message = data.error.message;
  } catch {}
  throw new DriveApiError(res.status, message);
}

export function makeDrive(token) {
  const headers = { Authorization: `Bearer ${token}` };

  async function findFile() {
    const url = `${FILES}?spaces=appDataFolder&q=${encodeURIComponent(`name='${STATE_FILE}'`)}&fields=files(id,modifiedTime,size)&pageSize=1`;
    const res = await check(await fetch(url, { headers }), 'Drive list');
    const data = await res.json();
    return data.files?.[0] || null;
  }

  async function download(fileId) {
    const res = await check(await fetch(`${FILES}/${fileId}?alt=media`, { headers }), 'Drive download');
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  }

  async function upload(fileId, content) {
    const body = JSON.stringify(content);
    if (fileId) {
      const res = await check(
        await fetch(`${UPLOAD}/${fileId}?uploadType=media`, {
          method: 'PATCH',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body,
        }),
        'Drive update'
      );
      return (await res.json()).id || fileId;
    }
    const boundary = 'almanac' + Date.now();
    const meta = JSON.stringify({ name: STATE_FILE, parents: ['appDataFolder'] });
    const multipart =
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n` +
      `--${boundary}\r\nContent-Type: application/json\r\n\r\n${body}\r\n--${boundary}--`;
    const res = await check(
      await fetch(`${UPLOAD}?uploadType=multipart&fields=id`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': `multipart/related; boundary=${boundary}` },
        body: multipart,
      }),
      'Drive create'
    );
    return (await res.json()).id;
  }

  return { findFile, download, upload };
}
