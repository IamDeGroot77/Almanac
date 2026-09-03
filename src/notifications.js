import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BRIEF_CATEGORY, ensureDayBracketCategories } from './dayBracket';
import { getNextAlarm, isAvailable as alarmAvailable } from '../modules/almanac-alarm';
import { dayKey } from './dates';
import { formatTime24 } from './due';

// Docs: https://docs.expo.dev/versions/v57.0.0/sdk/notifications/
//
// The morning brief follows the alarm clock: when the clock app has an alarm
// within the next 20 hours, the brief lands a minute after it. With no alarm
// it waits for the day to start (first open after sleep) and arrives then.

const REMINDER_CHANNEL = 'daily-brief';
const BRIEF_ID = 'daily-brief';
const AFTER_ALARM_MS = 60 * 1000;
const ALARM_HORIZON_MS = 20 * 60 * 60 * 1000;
const SENT_KEY = 'almanac:briefSentOn';

// Both buttons work from the shade and the watch without opening the app.
const BRIEF_CONTENT = {
  title: 'Good morning',
  body: "Tap Just one thing to get going, or I'm up if you've been up a while.",
  categoryIdentifier: BRIEF_CATEGORY,
};

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

async function prepare() {
  if (Platform.OS === 'web') return 'unsupported';
  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') return 'denied';
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(REMINDER_CHANNEL, {
      name: 'Morning brief',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
  await ensureDayBracketCategories();
  return 'ok';
}

// Returns { mode: 'alarm', at } | { mode: 'wake', alarmSupported } | { mode: 'denied' | 'unsupported' }.
export async function scheduleMorningBrief({ wakeTarget = null, now = Date.now() } = {}) {
  const ready = await prepare();
  if (ready !== 'ok') return { mode: ready };
  await Notifications.cancelScheduledNotificationAsync(BRIEF_ID).catch(() => {});
  const alarmAt = getNextAlarm();
  if (alarmAt && alarmAt > now && alarmAt - now < ALARM_HORIZON_MS) {
    const at = alarmAt + AFTER_ALARM_MS;
    await Notifications.scheduleNotificationAsync({
      identifier: BRIEF_ID,
      content: BRIEF_CONTENT,
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at, channelId: REMINDER_CHANNEL },
    });
    return { mode: 'alarm', at };
  }
  if (wakeTarget) {
    const [h, m] = wakeTarget.split(':').map(Number);
    await Notifications.scheduleNotificationAsync({
      identifier: BRIEF_ID,
      content: BRIEF_CONTENT,
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: h, minute: m || 0, channelId: REMINDER_CHANNEL },
    });
    return { mode: 'anchor', wakeTarget, alarmSupported: alarmAvailable() };
  }
  return { mode: 'wake', alarmSupported: alarmAvailable() };
}

// True when an alarm-tied brief already fired today, so the day start
// shouldn't send a second one.
export function briefDeliveredToday(status, now = Date.now()) {
  return status?.mode === 'alarm' && status.at <= now && dayKey(new Date(status.at)) === dayKey(new Date(now));
}

// Sends the brief right now, at most once per calendar day.
export async function sendBriefIfDue(now = Date.now()) {
  if (Platform.OS === 'web') return false;
  const today = dayKey(new Date(now));
  const sentOn = await AsyncStorage.getItem(SENT_KEY).catch(() => null);
  if (sentOn === today) return false;
  const ready = await prepare();
  if (ready !== 'ok') return false;
  await AsyncStorage.setItem(SENT_KEY, today).catch(() => {});
  await Notifications.scheduleNotificationAsync({ content: BRIEF_CONTENT, trigger: null });
  return true;
}

// Fires the brief immediately (developer helper).
export async function sendTestReminder() {
  const ready = await prepare();
  if (ready !== 'ok') return 'denied';
  await Notifications.scheduleNotificationAsync({ content: BRIEF_CONTENT, trigger: null });
  return 'sent';
}

export function reminderMessage(status) {
  if (!status) return '';
  switch (status.mode) {
    case 'alarm': {
      const d = new Date(status.at);
      const when = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
      const day = dayKey(d) === dayKey(new Date()) ? 'today' : 'tomorrow';
      return `Tied to your alarm: arrives ${when} ${day}, with I'm up and Just one thing buttons on the phone and the watch.`;
    }
    case 'anchor':
      return `No alarm set, so the brief comes at your up-by time, ${formatTime24(status.wakeTarget)}. An alarm within the day takes over when there is one.`;
    case 'wake':
      return status.alarmSupported
        ? 'No alarm set, so the brief arrives when your day starts (the first time you pick up the app after sleeping). Set an alarm and it follows that instead.'
        : 'Arrives when your day starts. Install the newer build and it follows your alarm clock when one is set.';
    case 'denied':
      return 'Notifications are off. Enable them in Settings to get the morning brief.';
    case 'unsupported':
      return 'Reminders come from the phone.';
    case 'error':
      return "Couldn't set up the morning brief.";
    default:
      return '';
  }
}
