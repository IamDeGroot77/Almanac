// Google Calendar REST, used by the laptop's Calendar tab.
// Reference: https://developers.google.com/calendar/api/v3/reference

const BASE = 'https://www.googleapis.com/calendar/v3';

export class CalendarApiError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'CalendarApiError';
    this.status = status;
  }
}

export function makeCalendarApi(token) {
  async function call(method, path, { query, body } = {}) {
    const url = new URL(BASE + path);
    for (const [k, v] of Object.entries(query || {})) if (v != null) url.searchParams.set(k, String(v));
    const res = await fetch(url.toString(), {
      method,
      headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      let message = `${method} ${path} failed (${res.status})`;
      try {
        const data = await res.json();
        if (data?.error?.message) message = data.error.message;
      } catch {}
      throw new CalendarApiError(res.status, message);
    }
    if (res.status === 204) return null;
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  }

  return {
    calendars: async () => (await call('GET', '/users/me/calendarList', { query: { minAccessRole: 'reader' } })).items || [],
    events: async (calendarId, timeMin, timeMax) => {
      const items = [];
      let pageToken;
      do {
        const page = await call('GET', `/calendars/${encodeURIComponent(calendarId)}/events`, {
          query: { timeMin: timeMin.toISOString(), timeMax: timeMax.toISOString(), singleEvents: true, orderBy: 'startTime', maxResults: 250, pageToken },
        });
        items.push(...(page.items || []));
        pageToken = page.nextPageToken;
      } while (pageToken);
      return items;
    },
    create: (calendarId, event) => call('POST', `/calendars/${encodeURIComponent(calendarId)}/events`, { body: event }),
    update: (calendarId, eventId, event) => call('PATCH', `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`, { body: event }),
    remove: (calendarId, eventId) => call('DELETE', `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`),
  };
}

// Normalise a Google event to what the screens need.
export function normalizeEvent(e, calendar) {
  const allDay = !!e.start?.date;
  const start = allDay ? new Date(e.start.date + 'T00:00:00') : new Date(e.start?.dateTime);
  const end = allDay ? new Date(e.end.date + 'T00:00:00') : new Date(e.end?.dateTime || e.start?.dateTime);
  return {
    id: e.id,
    calendarId: calendar.id,
    calendarName: calendar.summary,
    color: calendar.backgroundColor || null,
    title: e.summary || '(untitled)',
    allDay,
    start,
    end,
    location: e.location || null,
    description: e.description || null,
    editable: calendar.accessRole === 'owner' || calendar.accessRole === 'writer',
  };
}
