import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { isWeb } from './platform';

// Notification buttons tapped while the app is dead. Android runs this task
// headless for a custom action button ("Going to bed", "I'm up") when the
// app is backgrounded or terminated, so the tap is not lost overnight. The
// task only records the tap; the app applies it on its next launch through
// the ordinary notification router, anchored to when the notification was
// shown, so there is one code path for taps live and taps replayed.

export const TAP_TASK = 'almanac-notification-taps';
const KEY = 'almanac:pendingTaps';
const DEFAULT_ACTION = 'expo.modules.notifications.actions.DEFAULT';

function responseFrom(data) {
  if (!data || typeof data !== 'object') return null;
  if (typeof data.actionIdentifier === 'string') return data;
  for (const k of ['response', 'notificationResponse']) if (data[k] && typeof data[k].actionIdentifier === 'string') return data[k];
  return null;
}

export async function recordTap(data, now = Date.now()) {
  const r = responseFrom(data);
  if (!r || !r.actionIdentifier || r.actionIdentifier === DEFAULT_ACTION) return null;
  const tap = {
    action: r.actionIdentifier,
    at: Number(r.notification?.date) || now,
    id: r.notification?.request?.identifier || null,
    userText: r.userText || null,
    receivedAt: now,
  };
  let prev = [];
  try {
    prev = JSON.parse((await AsyncStorage.getItem(KEY)) || '[]');
  } catch {
    prev = [];
  }
  await AsyncStorage.setItem(KEY, JSON.stringify([...prev, tap].slice(-20)));
  return tap;
}

export async function drainPendingTaps() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return [];
    await AsyncStorage.removeItem(KEY);
    const taps = JSON.parse(raw);
    return Array.isArray(taps) ? taps : [];
  } catch {
    return [];
  }
}

// A recorded tap, shaped like the response the router already understands.
export function tapToResponse(tap) {
  return { actionIdentifier: tap.action, userText: tap.userText || undefined, notification: { date: tap.at, request: { identifier: tap.id || 'pending' } } };
}

// Module scope, from index.js, so the headless loader finds the task.
if (!isWeb) {
  try {
    TaskManager.defineTask(TAP_TASK, async ({ data, error }) => {
      if (error) return;
      try {
        await recordTap(data);
      } catch (err) {
        console.warn('Recording a notification tap failed', err?.message || err);
      }
    });
  } catch (err) {
    console.warn('Tap task not defined', err?.message || err);
  }
}

export async function registerTapTask() {
  if (isWeb) return;
  try {
    await Notifications.registerTaskAsync(TAP_TASK);
  } catch (err) {
    console.warn('Tap task not registered', err?.message || err);
  }
}
