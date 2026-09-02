import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

// Docs: https://docs.expo.dev/versions/v57.0.0/sdk/notifications/
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

export async function scheduleDailyReminder() {
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
      body: "Your day is ready. Review yesterday's list and see what's ahead.",
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

export function reminderMessage(status) {
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
