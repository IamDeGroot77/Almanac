// Thin client for the Google Tasks REST API.
// Reference: https://developers.google.com/workspace/tasks/reference/rest

const BASE = 'https://tasks.googleapis.com/tasks/v1';

export class GoogleApiError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'GoogleApiError';
    this.status = status;
  }
}

export const isNotFound = (err) => err instanceof GoogleApiError && err.status === 404;
export const isBadRequest = (err) => err instanceof GoogleApiError && err.status === 400;

export function makeApi(accessToken) {
  async function call(method, path, { query, body } = {}) {
    const url = new URL(BASE + path);
    if (query) {
      for (const [k, v] of Object.entries(query)) {
        if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
      }
    }
    const res = await fetch(url.toString(), {
      method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      let message = `${method} ${path} failed (${res.status})`;
      try {
        const data = await res.json();
        if (data?.error?.message) message = data.error.message;
      } catch {}
      throw new GoogleApiError(res.status, message);
    }
    if (res.status === 204) return null;
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  }

  async function paginate(path, query) {
    const items = [];
    let pageToken;
    do {
      const page = await call('GET', path, { query: { ...query, maxResults: 100, pageToken } });
      if (page?.items) items.push(...page.items);
      pageToken = page?.nextPageToken;
    } while (pageToken);
    return items;
  }

  return {
    listTaskLists: () => paginate('/users/@me/lists'),
    createTaskList: (title) => call('POST', '/users/@me/lists', { body: { title } }),
    patchTaskList: (listId, patch) =>
      call('PATCH', `/users/@me/lists/${encodeURIComponent(listId)}`, { body: patch }),
    deleteTaskList: (listId) => call('DELETE', `/users/@me/lists/${encodeURIComponent(listId)}`),

    listTasks: (listId) =>
      paginate(`/lists/${encodeURIComponent(listId)}/tasks`, {
        showCompleted: true,
        showHidden: true,
      }),
    insertTask: (listId, task) =>
      call('POST', `/lists/${encodeURIComponent(listId)}/tasks`, { body: task }),
    patchTask: (listId, taskId, patch) =>
      call('PATCH', `/lists/${encodeURIComponent(listId)}/tasks/${encodeURIComponent(taskId)}`, {
        body: patch,
      }),
    deleteTask: (listId, taskId) =>
      call('DELETE', `/lists/${encodeURIComponent(listId)}/tasks/${encodeURIComponent(taskId)}`),
  };
}
