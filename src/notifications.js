import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { BRIEF_CATEGORY, ensureDayBracketCategories } from './dayBracket';

// Docs: https://docs.expo.dev/versions/v57.0.0/sdk/notifications/
const REMINDER_HOUR = 6;
const REMINDER_MINUTE = 30;
const REMINDER_CHANNEL = 'daily-brief';

// Both buttons work from the shade and the watch without opening the app.
const BRIEF_CONTENT = {
  title: 'Good morning',
  body: "Tap I'm up to start the day, or Just one thing to get going.",
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

export async function scheduleDailyReminder() {
  if (Platform.OS === 'web') return 'unsupported';
  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') return 'denied';

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(REMINDER_CHANNEL, {
      name: 'Daily brief',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  // Replace only the daily brief; task reminders have their own identifiers.
  await ensureDayBracketCategories();
  await Notifications.cancelScheduledNotificationAsync('daily-brief').catch(() => {});
  await Notifications.scheduleNotificationAsync({
    identifier: 'daily-brief',
    content: BRIEF_CONTENT,
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: REMINDER_HOUR,
      minute: REMINDER_MINUTE,
      channelId: REMINDER_CHANNEL,
    },
  });
  return 'scheduled';
}

// Fires the daily brief immediately (developer helper).
export async function sendTestReminder() {
  if (Platform.OS === 'web') return 'denied';
  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') return 'denied';
  await ensureDayBracketCategories();
  await Notifications.scheduleNotificationAsync({
    content: BRIEF_CONTENT,
    trigger: null,
  });
  return 'sent';
}

export function reminderMessage(status) {
  switch (status) {
    case 'scheduled':
      return "Arrives at 6:30 AM with I'm up and Just one thing buttons, on the phone and the watch.";
    case 'denied':
      return 'Notifications are off. Enable them in Settings to get the 6:30 AM brief.';
    case 'unsupported':
      return 'Reminders come from the phone.';
    case 'error':
      return "Couldn't set up the daily brief.";
    default:
      return '';
  }
}
