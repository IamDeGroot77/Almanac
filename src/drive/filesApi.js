// The drop box: a folder Drive creates for Almanac (visible in your Drive
// as "Almanac Drop"), used to pass files between laptop and phone.
// Needs the drive.file scope: the app only sees files it created.

const FILES = 'https://www.googleapis.com/drive/v3/files';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files';
const FOLDER_NAME = 'Almanac Drop';
const FOLDER_MIME = 'application/vnd.google-apps.folder';

async function check(res, what) {
  if (res.ok) return res;
  let message = `${what} failed (${res.status})`;
  try {
    const data = await res.json();
    if (data?.error?.message) message = data.error.message;
  } catch {}
  const err = new Error(message);
  err.status = res.status;
  throw err;
}

export function makeDropBox(token) {
  const headers = { Authorization: `Bearer ${token}` };

  async function folderId() {
    const q = `name='${FOLDER_NAME}' and mimeType='${FOLDER_MIME}' and trashed=false`;
    const res = await check(await fetch(`${FILES}?q=${encodeURIComponent(q)}&fields=files(id)&pageSize=1`, { headers }), 'Drive folder lookup');
    const found = (await res.json()).files?.[0];
    if (found) return found.id;
    const created = await check(
      await fetch(`${FILES}?fields=id`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: FOLDER_NAME, mimeType: FOLDER_MIME }),
      }),
      'Drive folder create'
    );
    return (await created.json()).id;
  }

  async function list() {
    const id = await folderId();
    const q = `'${id}' in parents and trashed=false`;
    const res = await check(
      await fetch(`${FILES}?q=${encodeURIComponent(q)}&fields=files(id,name,size,mimeType,modifiedTime,webViewLink,appProperties)&orderBy=modifiedTime desc&pageSize=100`, { headers }),
      'Drive list'
    );
    return (await res.json()).files || [];
  }

  // `file` is a browser File/Blob; `from` tags which device sent it.
  async function upload(file, from) {
    const id = await folderId();
    const meta = { name: file.name, parents: [id], appProperties: { from } };
    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(meta)], { type: 'application/json' }));
    form.append('file', file);
    const res = await check(await fetch(`${UPLOAD}?uploadType=multipart&fields=id,name,size,modifiedTime,webViewLink`, { method: 'POST', headers, body: form }), 'Drive upload');
    return res.json();
  }

  async function download(fileId) {
    const res = await check(await fetch(`${FILES}/${fileId}?alt=media`, { headers }), 'Drive download');
    return res.blob();
  }

  async function remove(fileId) {
    await check(await fetch(`${FILES}/${fileId}`, { method: 'DELETE', headers }), 'Drive delete');
  }

  return { list, upload, download, remove };
}

export function describeSize(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
