import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import { dayListIdForOffset } from './store';
import { almanacToday } from './clock';
import { parseQuickTask } from './quickParse';
import { registerNotificationHandler } from './notificationRouter';
import { isWeb } from './platform';

// "Quick add" from the notification shade and the watch. A notification with
// two reply actions sits in the shade; Wear OS lets you answer them by
// voice. Replies become a task on Today (or another list) or a line in
// today's note. Responses are delivered through notificationRouter.

export const QUICK_ADD_CATEGORY = 'quick-add';
export const QUICK_ADD_ID = 'quick-add';
const ACTION_PREFIX = 'quick-';
const ACTION_TASK = 'quick-task';
const ACTION_NOTE = 'quick-note';

export { parseQuickTask };

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
      textInput: { submitButtonTitle: 'Save', placeholder: 'Journal entry' },
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

// Apply a spoken/typed line to the store.
export function applyQuickTask(store, text) {
  const parsed = parseQuickTask(text, { lists: store.lists, people: store.people });
  if (!parsed.text) return null;
  const targetList = parsed.listId || dayListIdForOffset(0);
  const listPerson = store.lists.find((l) => l.id === targetList)?.personId || null;
  const id = store.addTask(parsed.text, targetList, parsed.personId || listPerson);
  if (parsed.due && id) store.setTaskDue(id, parsed.due, null);
  return id;
}

export function useQuickAdd(store, { enabled }) {
  const storeRef = useRef(store);
  storeRef.current = store;

  useEffect(
    () =>
      registerNotificationHandler(ACTION_PREFIX, (response) => {
        const text = (response.userText || '').trim();
        if (!text) return;
        const s = storeRef.current;
        if (response.actionIdentifier === ACTION_TASK) applyQuickTask(s, text);
        else if (response.actionIdentifier === ACTION_NOTE) s.addJournalEntry(text, { source: 'voice' });
      }),
    []
  );

  useEffect(() => {
    if (!store.loaded || isWeb) return;
    (enabled ? showQuickAddNotification() : hideQuickAddNotification()).catch((err) =>
      console.warn('Quick add notification failed', err)
    );
  }, [enabled, store.loaded]);
}
