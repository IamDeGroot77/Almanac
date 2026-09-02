// Thin client for the Canvas LMS REST API.
// Reference: https://developerdocs.instructure.com/services/canvas

export class CanvasApiError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'CanvasApiError';
    this.status = status;
  }
}

// "school.instructure.com", "https://school.instructure.com/courses/1" -> "https://school.instructure.com"
export function normalizeHost(input) {
  let s = (input || '').trim();
  if (!s) return '';
  if (!/^https?:\/\//i.test(s)) s = `https://${s}`;
  try {
    const u = new URL(s);
    return `${u.protocol}//${u.host}`;
  } catch {
    return '';
  }
}

export function makeCanvasApi(host, token) {
  const base = normalizeHost(host);

  async function call(path, query = {}) {
    const url = new URL(`${base}/api/v1${path}`);
    for (const [k, v] of Object.entries(query)) {
      if (Array.isArray(v)) v.forEach((x) => url.searchParams.append(k, String(x)));
      else if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    }
    const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) {
      let message = `${path} failed (${res.status})`;
      try {
        const data = await res.json();
        const m = data?.errors?.[0]?.message || data?.message;
        if (m) message = m;
      } catch {}
      throw new CanvasApiError(res.status, message);
    }
    return { data: await res.json(), link: res.headers.get('Link') || res.headers.get('link') || '' };
  }

  // Follows Canvas's Link: <...>; rel="next" pagination.
  async function paginate(path, query = {}) {
    const items = [];
    let next = null;
    let first = true;
    while (first || next) {
      const { data, link } = first ? await call(path, { ...query, per_page: 100 }) : await callAbsolute(next);
      first = false;
      if (Array.isArray(data)) items.push(...data);
      const m = link.match(/<([^>]+)>;\s*rel="next"/);
      next = m ? m[1] : null;
    }
    return items;
  }

  async function callAbsolute(url) {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new CanvasApiError(res.status, `page failed (${res.status})`);
    return { data: await res.json(), link: res.headers.get('Link') || res.headers.get('link') || '' };
  }

  return {
    self: async () => (await call('/users/self')).data,
    courses: () =>
      paginate('/courses', { enrollment_state: 'active', 'include[]': ['total_scores', 'term'] }),
    assignments: (courseId) =>
      paginate(`/courses/${courseId}/assignments`, { 'include[]': ['submission'], order_by: 'due_at' }),
  };
}
