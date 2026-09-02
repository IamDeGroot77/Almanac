import { useEffect, useState } from 'react';
import { getValidAccessToken } from './google/auth';
import { makeDropBox } from './drive/filesApi';
import { isWeb } from './platform';

// Decoration: images in the Drive drop box whose names start with "art-"
// (art-luffy.jpg, art-01.png…) rotate daily on the Home page. The laptop's
// Files tab uploads them by drag and drop; the phone shows them too.
const cache = { at: 0, files: [] };

export function useArt(account, dayKey) {
  const [art, setArt] = useState(null); // { uri, name, headers? }
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!account) return setArt(null);
      try {
        if (Date.now() - cache.at > 30 * 60000) {
          const token = await getValidAccessToken();
          if (!token) return;
          cache.files = (await makeDropBox(token).list()).filter((f) => /^art-/i.test(f.name) && /image\//.test(f.mimeType || ''));
          cache.at = Date.now();
        }
        if (!cache.files.length) return setArt(null);
        let h = 0;
        for (const ch of dayKey || '') h = (h * 31 + ch.charCodeAt(0)) >>> 0;
        const file = cache.files[h % cache.files.length];
        const token = await getValidAccessToken();
        const url = `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`;
        if (isWeb) {
          const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
          const blob = await res.blob();
          const reader = new FileReader();
          reader.onload = () => !cancelled && setArt({ uri: reader.result, name: file.name });
          reader.readAsDataURL(blob);
        } else if (!cancelled) {
          setArt({ uri: url, name: file.name, headers: { Authorization: `Bearer ${token}` } });
        }
      } catch (err) {
        console.warn('Art load failed', err.message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [account, dayKey]);
  return art;
}
