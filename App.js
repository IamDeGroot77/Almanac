import { StatusBar } from 'expo-status-bar';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  Platform,
  Linking,
} from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
// Current class-based expo-calendar API. It only works in a development or
// production build (not Expo Go), which is what this app targets.
// Docs: https://docs.expo.dev/versions/v57.0.0/sdk/calendar/
import * as Calendar from 'expo-calendar';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

const TASKS_KEY = 'tasks';
const REMINDER_HOUR = 6;
const REMINDER_MINUTE = 30;
const REMINDER_CHANNEL = 'daily-brief';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

function dayBounds(offset) {
  const start = new Date();
  start.setDate(start.getDate() + offset);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function formatTime(date) {
  return new Date(date).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function formatHeaderDate(date) {
  return date.toLocaleDateString([], {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

async function scheduleDailyReminder() {
  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') return 'denied';

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(REMINDER_CHANNEL, {
      name: 'Daily brief',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  await Notifications.cancelAllScheduledNotificationsAsync();
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Your Almanac',
      body: "Your day is ready. Tap to see today's events and tasks.",
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: REMINDER_HOUR,
      minute: REMINDER_MINUTE,
      channelId: REMINDER_CHANNEL,
    },
  });
  return 'scheduled';
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AlmanacScreen />
    </SafeAreaProvider>
  );
}

function AlmanacScreen() {
  const [dayOffset, setDayOffset] = useState(0); // 0 = today, 1 = tomorrow
  const [events, setEvents] = useState([]);
  const [calendarStatus, setCalendarStatus] = useState('loading'); // loading | granted | denied | error
  const [refreshing, setRefreshing] = useState(false);

  const [tasks, setTasks] = useState([]);
  const [tasksLoaded, setTasksLoaded] = useState(false);
  const [input, setInput] = useState('');

  const [reminderStatus, setReminderStatus] = useState('pending');

  const loadEvents = useCallback(async (offset) => {
    try {
      const { status } = await Calendar.requestCalendarPermissions();
      if (status !== 'granted') {
        setCalendarStatus('denied');
        setEvents([]);
        return;
      }

      const calendars = await Calendar.getCalendars(Calendar.EntityTypes.EVENT);
      const { start, end } = dayBounds(offset);
      const found = await Calendar.listEvents(calendars, start, end);

      const sorted = [...found].sort((a, b) => {
        if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
        return new Date(a.startDate) - new Date(b.startDate);
      });

      setEvents(
        sorted.map((ev) => ({
          id: ev.id,
          title: ev.title || '(Untitled)',
          allDay: !!ev.allDay,
          time: ev.allDay ? 'All day' : formatTime(ev.startDate),
          location: ev.location || null,
        }))
      );
      setCalendarStatus('granted');
    } catch (err) {
      console.warn('Calendar load failed', err);
      setCalendarStatus('error');
      setEvents([]);
    }
  }, []);

  // Reload events whenever the selected day changes.
  useEffect(() => {
    loadEvents(dayOffset);
  }, [dayOffset, loadEvents]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadEvents(dayOffset);
    setRefreshing(false);
  }, [dayOffset, loadEvents]);

  // Daily 6:30 AM reminder.
  useEffect(() => {
    scheduleDailyReminder()
      .then(setReminderStatus)
      .catch((err) => {
        console.warn('Reminder setup failed', err);
        setReminderStatus('error');
      });
  }, []);

  // Load saved tasks once on startup.
  useEffect(() => {
    AsyncStorage.getItem(TASKS_KEY)
      .then((saved) => {
        if (saved) setTasks(JSON.parse(saved));
      })
      .catch((err) => console.warn('Task load failed', err))
      .finally(() => setTasksLoaded(true));
  }, []);

  // Persist tasks, but only after the initial load so an empty array
  // never overwrites what was saved.
  useEffect(() => {
    if (!tasksLoaded) return;
    AsyncStorage.setItem(TASKS_KEY, JSON.stringify(tasks)).catch((err) =>
      console.warn('Task save failed', err)
    );
  }, [tasks, tasksLoaded]);

  const addTask = () => {
    const text = input.trim();
    if (!text) return;
    setTasks((prev) => [...prev, { id: Date.now().toString(), text, done: false }]);
    setInput('');
  };

  const toggleTask = (id) =>
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));

  const deleteTask = (id) => setTasks((prev) => prev.filter((t) => t.id !== id));

  const clearCompleted = () => setTasks((prev) => prev.filter((t) => !t.done));

  const openTasks = tasks.filter((t) => !t.done);
  const doneTasks = tasks.filter((t) => t.done);
  const headerDate = dayBounds(dayOffset).start;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <Text style={styles.kicker}>{dayOffset === 0 ? 'Today' : 'Tomorrow'}</Text>
        <Text style={styles.title}>{formatHeaderDate(headerDate)}</Text>

        <View style={styles.segment}>
          <SegmentButton label="Today" active={dayOffset === 0} onPress={() => setDayOffset(0)} />
          <SegmentButton label="Tomorrow" active={dayOffset === 1} onPress={() => setDayOffset(1)} />
        </View>

        <Section title="Events">
          {calendarStatus === 'loading' && <Text style={styles.muted}>Loading your calendar…</Text>}

          {calendarStatus === 'denied' && (
            <View>
              <Text style={styles.muted}>
                Almanac needs calendar access to show your events.
              </Text>
              <View style={styles.row}>
                <SmallButton label="Try again" onPress={() => loadEvents(dayOffset)} />
                <SmallButton label="Open Settings" onPress={() => Linking.openSettings()} />
              </View>
            </View>
          )}

          {calendarStatus === 'error' && (
            <View>
              <Text style={styles.muted}>Couldn't read your calendar.</Text>
              <SmallButton label="Try again" onPress={() => loadEvents(dayOffset)} />
            </View>
          )}

          {calendarStatus === 'granted' && events.length === 0 && (
            <Text style={styles.muted}>Nothing on the calendar.</Text>
          )}

          {calendarStatus === 'granted' &&
            events.map((e) => (
              <View key={e.id} style={styles.eventRow}>
                <Text style={styles.eventTime}>{e.time}</Text>
                <View style={styles.eventBody}>
                  <Text style={styles.eventTitle}>{e.title}</Text>
                  {e.location ? <Text style={styles.eventLocation}>{e.location}</Text> : null}
                </View>
              </View>
            ))}
        </Section>

        <Section
          title="Tasks"
          action={
            doneTasks.length > 0 ? (
              <SmallButton label={`Clear ${doneTasks.length} done`} onPress={clearCompleted} />
            ) : null
          }
        >
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              value={input}
              onChangeText={setInput}
              placeholder="Add a task…"
              returnKeyType="done"
              onSubmitEditing={addTask}
              submitBehavior="submit"
            />
            <TouchableOpacity style={styles.addButton} onPress={addTask} accessibilityRole="button">
              <Text style={styles.addButtonText}>Add</Text>
            </TouchableOpacity>
          </View>

          {tasks.length === 0 && <Text style={styles.muted}>No tasks yet.</Text>}

          {[...openTasks, ...doneTasks].map((t) => (
            <View key={t.id} style={styles.taskRow}>
              <TouchableOpacity
                style={styles.taskMain}
                onPress={() => toggleTask(t.id)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: t.done }}
              >
                <Text style={[styles.checkbox, t.done && styles.checkboxDone]}>
                  {t.done ? '✓' : ''}
                </Text>
                <Text style={[styles.taskText, t.done && styles.taskTextDone]}>{t.text}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => deleteTask(t.id)}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel={`Delete ${t.text}`}
              >
                <Text style={styles.deleteText}>✕</Text>
              </TouchableOpacity>
            </View>
          ))}
        </Section>

        <Text style={styles.footer}>{reminderMessage(reminderStatus)}</Text>
      </ScrollView>
      <StatusBar style="dark" />
    </SafeAreaView>
  );
}

function reminderMessage(status) {
  switch (status) {
    case 'scheduled':
      return 'Daily brief arrives at 6:30 AM.';
    case 'denied':
      return 'Notifications are off. Enable them in Settings to get the 6:30 AM brief.';
    case 'error':
      return "Couldn't set up the daily brief.";
    default:
      return '';
  }
}

function Section({ title, action, children }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {action}
      </View>
      {children}
    </View>
  );
}

function SegmentButton({ label, active, onPress }) {
  return (
    <TouchableOpacity
      style={[styles.segmentButton, active && styles.segmentButtonActive]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
    >
      <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function SmallButton({ label, onPress }) {
  return (
    <TouchableOpacity style={styles.smallButton} onPress={onPress} accessibilityRole="button">
      <Text style={styles.smallButtonText}>{label}</Text>
    </TouchableOpacity>
  );
}

const colors = {
  bg: '#FFFFFF',
  ink: '#1B1F24',
  muted: '#6B7280',
  line: '#E5E7EB',
  accent: '#1F5FA8',
  accentSoft: '#E6F4FE',
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  container: { padding: 20, paddingBottom: 40 },

  kicker: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.accent,
  },
  title: { fontSize: 26, fontWeight: '700', color: colors.ink, marginTop: 4 },

  segment: {
    flexDirection: 'row',
    marginTop: 16,
    backgroundColor: colors.accentSoft,
    borderRadius: 10,
    padding: 3,
  },
  segmentButton: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  segmentButtonActive: { backgroundColor: colors.bg },
  segmentText: { fontSize: 14, fontWeight: '600', color: colors.accent },
  segmentTextActive: { color: colors.ink },

  section: { marginTop: 28 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: colors.ink },

  muted: { color: colors.muted, fontSize: 15, marginBottom: 8 },
  row: { flexDirection: 'row', gap: 10, marginTop: 4 },

  eventRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  eventTime: { width: 80, fontSize: 14, color: colors.muted, paddingTop: 2 },
  eventBody: { flex: 1 },
  eventTitle: { fontSize: 16, color: colors.ink },
  eventLocation: { fontSize: 13, color: colors.muted, marginTop: 2 },

  inputRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  addButton: {
    backgroundColor: colors.accent,
    borderRadius: 8,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  addButtonText: { color: '#FFFFFF', fontWeight: '600', fontSize: 15 },

  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  taskMain: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.accent,
    textAlign: 'center',
    lineHeight: 20,
    fontSize: 14,
    color: '#FFFFFF',
    marginRight: 12,
  },
  checkboxDone: { backgroundColor: colors.accent },
  taskText: { fontSize: 16, color: colors.ink, flex: 1 },
  taskTextDone: { textDecorationLine: 'line-through', color: colors.muted },
  deleteText: { color: colors.muted, fontSize: 16, paddingHorizontal: 8 },

  smallButton: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  smallButtonText: { color: colors.accent, fontWeight: '600', fontSize: 13 },

  footer: { marginTop: 32, fontSize: 13, color: colors.muted, textAlign: 'center' },
});
