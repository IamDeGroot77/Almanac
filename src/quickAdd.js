import { useCallback, useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import { dayListIdForOffset } from './store';
import { almanacToday } from './clock';
import { parseQuickTask } from './quickParse';

// "Quick add" from the notification shade and the watch. A notification with
// two reply actions sits in the shade; Wear OS lets you answer them by
// voice. Replies arrive as notification responses with userText and are
// turned into a task on Today (or another list) or a line in today's note.
//
// If the app isn't running when you reply, Android holds the response and
// hands it over on the next launch, so nothing is lost.

export const QUICK_ADD_CATEGORY = 'quick-add';
export const QUICK_ADD_ID = 'quick-add';
const ACTION_TASK = 'quick-task';
const ACTION_NOTE = 'quick-note';

export async function ensureQuickAddCategory() {
  await Notifications.setNotificationCategoryAsync(QUICK_ADD_CATEGORY, [
    {
      identifier: ACTION_TASK,
      buttonTitle: 'Speak a task',
      textInput: { submitButtonTitle: 'Add', placeholder: 'What needs doing?' },
      options: { opensAppToForeground: false },
    },
    {
      identifier: ACTION_NOTE,
      buttonTitle: 'Speak a note',
      textInput: { submitButtonTitle: 'Save', placeholder: 'Note for today' },
      options: { opensAppToForeground: false },
    },
  ]);
}

export async function showQuickAddNotification() {
  await ensureQuickAddCategory();
  await Notifications.scheduleNotificationAsync({
    identifier: QUICK_ADD_ID,
    content: {
      title: 'Almanac',
      body: 'Speak a task or a note.',
      categoryIdentifier: QUICK_ADD_CATEGORY,
      sticky: true,
      autoDismiss: false,
      sound: false,
    },
    trigger: null,
  });
}

export async function hideQuickAddNotification() {
  await Notifications.dismissNotificationAsync(QUICK_ADD_ID).catch(() => {});
}

export { parseQuickTask };

export function useQuickAdd(store, { enabled }) {
  const storeRef = useRef(store);
  storeRef.current = store;
  const handled = useRef(new Set());

  const handle = useCallback((response) => {
    if (!response) return;
    const id = `${response.notification?.request?.identifier}:${response.notification?.date}:${response.actionIdentifier}`;
    if (handled.current.has(id)) return;
    handled.current.add(id);
    const text = (response.userText || '').trim();
    if (!text) return;
    const s = storeRef.current;
    if (response.actionIdentifier === ACTION_TASK) {
      const parsed = parseQuickTask(text, { lists: s.lists, people: s.people });
      if (!parsed.text) return;
      const listId = parsed.listId || (parsed.due ? null : dayListIdForOffset(0));
      const targetList = listId || dayListIdForOffset(0);
      s.addTask(parsed.text, targetList, parsed.personId || s.lists.find((l) => l.id === targetList)?.personId || null);
      if (parsed.due) {
        // The task was just added; set its due date on the next tick when it exists.
        setTimeout(() => {
          const latest = storeRef.current.tasks.filter((t) => t.text === parsed.text).sort((a, b) => b.createdAt - a.createdAt)[0];
          if (latest) storeRef.current.setTaskDue(latest.id, parsed.due, null);
        }, 0);
      }
    } else if (response.actionIdentifier === ACTION_NOTE) {
      const key = almanacToday();
      const existing = s.dayNotes[key] || '';
      s.setDayNote(key, existing ? `${existing}\n${text}` : text);
    }
  }, []);

  // Live responses while the app is running.
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener(handle);
    return () => sub.remove();
  }, [handle]);

  // A response that arrived while the app was closed.
  const last = Notifications.useLastNotificationResponse();
  useEffect(() => {
    if (last && store.loaded) handle(last);
  }, [last, store.loaded, handle]);

  // Keep the shade notification in step with the setting.
  useEffect(() => {
    if (!store.loaded) return;
    (enabled ? showQuickAddNotification() : hideQuickAddNotification()).catch((err) =>
      console.warn('Quick add notification failed', err)
    );
  }, [enabled, store.loaded]);
}
