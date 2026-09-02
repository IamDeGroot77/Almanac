import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, shared } from '../../theme';
import WebPage from './WebPage';
import { SmallButton, PrimaryButton } from '../../components/Buttons';
import { dayKey, parseDayKey } from '../../dates';
import { almanacToday } from '../../clock';
import { getValidAccessToken } from '../../google/auth';
import { makeCalendarApi, normalizeEvent } from '../../google/calendarApi';
import { parseTimeInput, formatTime24 } from '../../due';

// A month grid of your Google Calendar with tasks and assignments laid over.
// Click a day to add an event or a task there; click an event to edit or
// delete it. Reads every calendar on the account; writes go to the one you
// pick (your primary by default).

const DAY = 86400000;

export default function CalendarScreen({ store, google, onOpenTask }) {
  const today = almanacToday();
  const [monthOffset, setMonthOffset] = useState(0);
  const [calendars, setCalendars] = useState([]);
  const [events, setEvents] = useState([]);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState(null);
  const [selectedDay, setSelectedDay] = useState(null);
  const [editing, setEditing] = useState(null); // { id?, calendarId, title, dayKey, start, end, allDay }
  const [hidden, setHidden] = useState(() => new Set());

  const first = parseDayKey(today);
  first.setDate(1);
  first.setMonth(first.getMonth() + monthOffset);
  const gridStart = new Date(first);
  gridStart.setDate(1 - ((first.getDay() + 6) % 7)); // Monday before the 1st
  const cells = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart.getTime() + i * DAY);
    return { key: dayKey(d), date: d, inMonth: d.getMonth() === first.getMonth() };
  });
  const gridEnd = new Date(gridStart.getTime() + 42 * DAY);

  const load = useCallback(async () => {
    if (!google.account) return;
    setStatus('loading');
    setError(null);
    try {
      const token = await getValidAccessToken();
      if (!token) throw new Error('Sign in again to load your calendar.');
      const api = makeCalendarApi(token);
      const cals = await api.calendars();
      setCalendars(cals);
      const all = [];
      for (const c of cals) {
        try {
          const items = await api.events(c.id, gridStart, gridEnd);
          all.push(...items.map((e) => normalizeEvent(e, c)));
        } catch (err) {
          console.warn('Calendar read failed', c.summary, err.message);
        }
      }
      setEvents(all);
      setStatus('idle');
    } catch (err) {
      setStatus('error');
      setError(err.message);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [google.account, monthOffset]);

  useEffect(() => {
    load();
  }, [load]);

  const byDay = useMemo(() => {
    const map = new Map();
    for (const e of events) {
      if (hidden.has(e.calendarId)) continue;
      // Spread multi-day events across their days.
      const s = new Date(e.start);
      s.setHours(0, 0, 0, 0);
      const endExclusive = e.allDay ? e.end.getTime() : new Date(e.end).setHours(0, 0, 0, 0) + (e.end.getHours() || e.end.getMinutes() ? DAY : 0);
      for (let t = s.getTime(); t < Math.max(endExclusive, s.getTime() + 1); t += DAY) {
        const k = dayKey(new Date(t));
        if (!map.has(k)) map.set(k, []);
        map.get(k).push(e);
      }
    }
    return map;
  }, [events, hidden]);

  const tasksByDay = useMemo(() => {
    const map = new Map();
    for (const t of store.tasks) {
      if (t.done || t.parentId) continue;
      const k = t.listId.startsWith('day:') ? t.listId.slice(4) : t.due;
      if (!k) continue;
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(t);
    }
    return map;
  }, [store.tasks]);

  const primary = calendars.find((c) => c.primary) || calendars.find((c) => c.accessRole === 'owner') || null;

  const save = async () => {
    if (!editing?.title?.trim()) return;
    try {
      const token = await getValidAccessToken();
      const api = makeCalendarApi(token);
      const body = { summary: editing.title.trim() };
      if (editing.allDay) {
        const endKey = dayKey(new Date(parseDayKey(editing.dayKey).getTime() + DAY));
        body.start = { date: editing.dayKey };
        body.end = { date: endKey };
      } else {
        const st = parseTimeInput(editing.start) || '09:00';
        const en = parseTimeInput(editing.end) || addHour(st);
        body.start = { dateTime: localIso(editing.dayKey, st) };
        body.end = { dateTime: localIso(editing.dayKey, en) };
      }
      if (editing.id) await api.update(editing.calendarId, editing.id, body);
      else await api.create(editing.calendarId || primary?.id || 'primary', body);
      setEditing(null);
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const remove = async () => {
    if (!editing?.id) return;
    try {
      const token = await getValidAccessToken();
      await makeCalendarApi(token).remove(editing.calendarId, editing.id);
      setEditing(null);
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const openEvent = (e) =>
    setEditing({
      id: e.id,
      calendarId: e.calendarId,
      title: e.title,
      dayKey: dayKey(e.start),
      allDay: e.allDay,
      start: e.allDay ? '' : formatTime24(`${String(e.start.getHours()).padStart(2, '0')}:${String(e.start.getMinutes()).padStart(2, '0')}`),
      end: e.allDay ? '' : formatTime24(`${String(e.end.getHours()).padStart(2, '0')}:${String(e.end.getMinutes()).padStart(2, '0')}`),
      editable: e.editable,
    });

  const newEventOn = (key) => setEditing({ calendarId: primary?.id, title: '', dayKey: key, allDay: false, start: '9:00', end: '10:00', editable: true });

  if (!google.account) {
    return (
      <WebPage title="Calendar">
        <Text style={shared.muted}>Sign in with Google in Settings and your calendars appear here.</Text>
      </WebPage>
    );
  }

  return (
    <WebPage
      title={first.toLocaleDateString([], { month: 'long', year: 'numeric' })}
      subtitle="Click a day to add, click an event to edit. Tasks and assignments show underneath the events."
      wide
      actions={
        <>
          <SmallButton label="‹" onPress={() => setMonthOffset(monthOffset - 1)} />
          <SmallButton label="Today" onPress={() => setMonthOffset(0)} />
          <SmallButton label="›" onPress={() => setMonthOffset(monthOffset + 1)} />
          <SmallButton label={status === 'loading' ? 'Loading…' : 'Refresh'} onPress={load} />
        </>
      }
    >
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
        {calendars.map((c) => (
          <span
            key={c.id}
            onClick={() => setHidden((h) => { const n = new Set(h); n.has(c.id) ? n.delete(c.id) : n.add(c.id); return n; })}
            style={{ fontSize: 12, padding: '3px 8px', borderRadius: 999, border: `1px solid ${c.backgroundColor || colors.line}`, background: hidden.has(c.id) ? 'transparent' : c.backgroundColor || colors.accentSoft, color: hidden.has(c.id) ? colors.muted : '#fff', cursor: 'pointer', textShadow: hidden.has(c.id) ? 'none' : '0 0 2px rgba(0,0,0,0.4)' }}
            title={hidden.has(c.id) ? 'Show' : 'Hide'}
          >
            {c.summary}
          </span>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
          <div key={d} style={{ fontSize: 11, color: colors.muted, textAlign: 'center', padding: 4 }}>
            {d}
          </div>
        ))}
        {cells.map((c) => {
          const dayEvents = byDay.get(c.key) || [];
          const dayTasks = tasksByDay.get(c.key) || [];
          const isToday = c.key === today;
          return (
            <div
              key={c.key}
              onClick={() => setSelectedDay(c.key)}
              onDoubleClick={() => newEventOn(c.key)}
              style={{
                minHeight: 108,
                borderRadius: 8,
                border: `1px solid ${selectedDay === c.key ? colors.accent : colors.line}`,
                background: isToday ? colors.accentSoft : colors.bg,
                opacity: c.inMonth ? 1 : 0.5,
                padding: 6,
                cursor: 'pointer',
                overflow: 'hidden',
              }}
              title="Double-click to add an event"
            >
              <div style={{ fontSize: 12, fontWeight: 700, color: isToday ? colors.accent : colors.ink }}>{c.date.getDate()}</div>
              {dayEvents.slice(0, 4).map((e) => (
                <div
                  key={e.id + c.key}
                  onClick={(ev) => {
                    ev.stopPropagation();
                    openEvent(e);
                  }}
                  style={{ fontSize: 11, marginTop: 2, padding: '1px 4px', borderRadius: 4, background: e.color || colors.accent, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                  title={`${e.title}${e.allDay ? '' : ` · ${e.start.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`}`}
                >
                  {e.allDay ? '' : e.start.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).replace(':00', '') + ' '}
                  {e.title}
                </div>
              ))}
              {dayEvents.length > 4 ? <div style={{ fontSize: 10, color: colors.muted }}>+{dayEvents.length - 4} more</div> : null}
              {dayTasks.slice(0, 3).map((t) => (
                <div
                  key={t.id}
                  onClick={(ev) => {
                    ev.stopPropagation();
                    onOpenTask(t);
                  }}
                  style={{ fontSize: 11, marginTop: 2, padding: '1px 4px', borderRadius: 4, border: `1px solid ${t.canvasId ? colors.warn : colors.line}`, color: colors.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                  title={t.canvasCourse ? `${t.text} · ${t.canvasCourse}` : t.text}
                >
                  ○ {t.text}
                </div>
              ))}
              {dayTasks.length > 3 ? <div style={{ fontSize: 10, color: colors.muted }}>+{dayTasks.length - 3} tasks</div> : null}
            </div>
          );
        })}
      </div>

      {selectedDay && !editing ? (
        <View style={styles.dayPanel}>
          <Text style={styles.dayTitle}>{parseDayKey(selectedDay).toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}</Text>
          {(byDay.get(selectedDay) || []).map((e) => (
            <Text key={e.id} style={styles.dayLine} onPress={() => openEvent(e)}>
              {e.allDay ? 'All day' : `${e.start.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} – ${e.end.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`} · {e.title}
              <Text style={styles.dayMeta}> {e.calendarName}</Text>
            </Text>
          ))}
          {(tasksByDay.get(selectedDay) || []).map((t) => (
            <Text key={t.id} style={styles.dayLine} onPress={() => onOpenTask(t)}>
              ○ {t.text}
              {t.canvasCourse ? <Text style={styles.dayMeta}> {t.canvasCourse}</Text> : null}
            </Text>
          ))}
          <View style={styles.dayActions}>
            <SmallButton label="+ Event" onPress={() => newEventOn(selectedDay)} />
            <SmallButton label="+ Task on this day" onPress={() => { const id = store.addTask('New task', `day:${selectedDay}`); if (id) onOpenTask({ id }); }} />
          </View>
        </View>
      ) : null}

      {editing ? (
        <View style={styles.editor}>
          <Text style={styles.dayTitle}>{editing.id ? 'Edit event' : 'New event'} · {parseDayKey(editing.dayKey).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}</Text>
          <TextInput style={[shared.input, styles.input]} value={editing.title} onChangeText={(v) => setEditing({ ...editing, title: v })} placeholder="Title" placeholderTextColor={colors.muted} autoFocus editable={editing.editable} />
          <View style={styles.row}>
            <SmallButton label={editing.allDay ? 'All day ✓' : 'All day'} onPress={() => setEditing({ ...editing, allDay: !editing.allDay })} />
            {!editing.allDay ? (
              <>
                <TextInput style={[shared.input, styles.time]} value={editing.start} onChangeText={(v) => setEditing({ ...editing, start: v })} placeholder="9:00" placeholderTextColor={colors.muted} />
                <Text style={shared.muted}>to</Text>
                <TextInput style={[shared.input, styles.time]} value={editing.end} onChangeText={(v) => setEditing({ ...editing, end: v })} placeholder="10:00" placeholderTextColor={colors.muted} />
              </>
            ) : null}
            {!editing.id && calendars.length > 1 ? (
              <select value={editing.calendarId || ''} onChange={(e) => setEditing({ ...editing, calendarId: e.target.value })} style={{ fontSize: 13, padding: 6, borderRadius: 8, border: `1px solid ${colors.line}`, background: colors.bg, color: colors.ink }}>
                {calendars.filter((c) => c.accessRole === 'owner' || c.accessRole === 'writer').map((c) => (
                  <option key={c.id} value={c.id}>{c.summary}</option>
                ))}
              </select>
            ) : null}
          </View>
          <View style={styles.row}>
            {editing.editable ? <PrimaryButton label="Save" onPress={save} /> : <Text style={shared.muted}>Read-only calendar.</Text>}
            {editing.id && editing.editable ? <SmallButton label="Delete" onPress={remove} /> : null}
            <SmallButton label="Cancel" onPress={() => setEditing(null)} />
          </View>
        </View>
      ) : null}
    </WebPage>
  );
}

function addHour(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return `${String((h + 1) % 24).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function localIso(key, hhmm) {
  const d = parseDayKey(key);
  const [h, m] = hhmm.split(':').map(Number);
  d.setHours(h, m, 0, 0);
  const off = -d.getTimezoneOffset();
  const sign = off >= 0 ? '+' : '-';
  const pad = (n) => String(Math.abs(n)).padStart(2, '0');
  return `${key}T${pad(h)}:${pad(m)}:00${sign}${pad(Math.floor(Math.abs(off) / 60))}:${pad(Math.abs(off) % 60)}`;
}

const styles = StyleSheet.create({
  error: { color: colors.danger, marginBottom: 8 },
  dayPanel: { marginTop: 16, borderWidth: 1, borderColor: colors.line, borderRadius: 12, padding: 14 },
  dayTitle: { fontSize: 16, fontWeight: '700', color: colors.ink, marginBottom: 8 },
  dayLine: { fontSize: 14, color: colors.ink, paddingVertical: 4 },
  dayMeta: { fontSize: 12, color: colors.muted },
  dayActions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  editor: { marginTop: 16, borderWidth: 1, borderColor: colors.accent, borderRadius: 12, padding: 14, gap: 10 },
  input: { flex: 0 },
  time: { flex: 0, width: 90, paddingVertical: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
});
