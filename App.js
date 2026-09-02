import { StatusBar } from 'expo-status-bar';
import { AppState, StyleSheet, View } from 'react-native';
import { useEffect, useMemo, useState } from 'react';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { colors } from './src/theme';
import { dayKey, describeDayKey, parseDayKey } from './src/dates';
import { setAlmanacToday, almanacDayFromOffset, openDayKey, lastClosedDay } from './src/clock';
import {
  useAlmanacStore,
  pastUnfinished,
  dayListIdForOffset,
  tasksForList,
  personOf,
  personName,
  isDayList,
  dayOfList,
} from './src/store';
import { formatDuration } from './src/durations';
import { dueStatus } from './src/due';
import { routineProgress } from './src/routines';
import useCalendarEvents from './src/useCalendarEvents';
import useTaskReminders from './src/reminders';
import { scheduleDailyReminder } from './src/notifications';
import { useGoogleAuth } from './src/google/auth';
import useGoogleSync from './src/google/useGoogleSync';

import { useSleepDetection } from './src/sleep';
import { useCanvasAuth } from './src/canvas/auth';
import useCanvasSync from './src/canvas/useCanvasSync';
import useAssignmentCalendar from './src/assignmentCalendar';
import { useQuickAdd } from './src/quickAdd';
import useTaskCheckins from './src/checkins';
import TabBar from './src/components/TabBar';
import TodayScreen from './src/screens/TodayScreen';
import ListsScreen from './src/screens/ListsScreen';
import InsightsScreen from './src/screens/InsightsScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import FocusModal from './src/components/FocusModal';
import TaskSheet from './src/components/TaskSheet';
import ListOptionsModal from './src/components/ListOptionsModal';
import NameModal from './src/components/NameModal';
import RoutineEditorModal from './src/components/RoutineEditorModal';

export default function App() {
  return (
    <SafeAreaProvider>
      <AlmanacApp />
    </SafeAreaProvider>
  );
}

function AlmanacApp() {
  const [tab, setTab] = useState('today');
  const [dayOffset, setDayOffset] = useState(0); // 0 = today, 1 = tomorrow
  const [personFilter, setPersonFilter] = useState('all'); // 'all' | person id
  const store = useAlmanacStore();

  // ----- the almanac day -------------------------------------------------
  // The day you're in is the one opened with "I'm up" and not yet closed,
  // even past midnight. Otherwise it's the calendar date.
  const calendarToday = dayKey(new Date());
  const openKey = openDayKey(store.days);
  const today = openKey && openKey <= calendarToday ? openKey : calendarToday;
  setAlmanacToday(today);
  const pastMidnight = today !== calendarToday;
  const openDay = openKey ? { key: openKey, ...store.days[openKey] } : null;

  // Forgotten Good night: close a stale day on launch, on foreground, and
  // every few minutes while the app is open.
  useEffect(() => {
    store.autoCloseStaleDay();
    const sub = AppState.addEventListener('change', (s) => s === 'active' && store.autoCloseStaleDay());
    const timer = setInterval(store.autoCloseStaleDay, 5 * 60 * 1000);
    return () => {
      sub.remove();
      clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.loaded]);

  const calendar = useCalendarEvents(dayOffset, today);
  const google = useGoogleAuth();
  const sync = useGoogleSync(store, google);
  useTaskReminders(store.tasks, store.loaded);
  const sleep = useSleepDetection(store);
  const canvas = useCanvasAuth();
  const canvasSync = useCanvasSync(store, canvas);
  const assignmentCalendar = useAssignmentCalendar(store, {
    enabled: !!store.prefs.assignmentsToCalendar && canvas.connected,
    calendarId: store.prefs.assignmentCalendarId,
  });
  useQuickAdd(store, { enabled: !!store.prefs.quickAddNotification });
  useTaskCheckins(store, { minutes: store.prefs.checkinMinutes ?? 30 });
  const toggleAssignmentCalendar = async (on) => {
    store.setPref('assignmentsToCalendar', on);
    if (!on) await assignmentCalendar.removeAll();
  };

  const [reminderStatus, setReminderStatus] = useState('pending');
  const [focusTaskId, setFocusTaskId] = useState(null);
  const [reviewDismissed, setReviewDismissed] = useState(false);
  const [wrapOpen, setWrapOpen] = useState(false);
  const [sheetTaskId, setSheetTaskId] = useState(null);
  const [optionsListId, setOptionsListId] = useState(null);
  const [renamingListId, setRenamingListId] = useState(null);
  const [addingList, setAddingList] = useState(false);
  const [addingPerson, setAddingPerson] = useState(false);
  const [editingRoutine, setEditingRoutine] = useState(null); // null | {} (new) | routine

  useEffect(() => {
    scheduleDailyReminder()
      .then(setReminderStatus)
      .catch((err) => {
        console.warn('Reminder setup failed', err);
        setReminderStatus('error');
      });
  }, []);

  const onRefresh = async () => {
    await Promise.all([calendar.refresh(), sync.syncNow(), canvasSync.syncNow()]);
  };

  const dayListId = dayListIdForOffset(dayOffset);
  const headerDate = almanacDayFromOffset(dayOffset);

  // ----- people -----------------------------------------------------------
  const matchesFilter = (t) => personFilter === 'all' || personOf(t) === personFilter;
  const visibleTasks = useMemo(
    () => store.tasks.filter(matchesFilter),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [store.tasks, personFilter]
  );
  const tagFor = (t) =>
    personFilter === 'all' && personOf(t) !== 'me' ? personName(store.people, t.personId) : null;
  const visibleLists = store.lists.filter(
    (l) =>
      personFilter === 'all' ||
      personOf(l) === personFilter ||
      store.tasks.some((t) => t.listId === l.id && matchesFilter(t))
  );
  const visibleRoutines = store.routines.filter(matchesFilter);
  const filterName = personFilter === 'all' ? null : personName(store.people, personFilter);

  const addTask = (text, listId) => {
    const list = store.lists.find((l) => l.id === listId);
    const personId = personFilter !== 'all' ? personFilter : list?.personId || null;
    store.addTask(text, listId, personId);
  };
  const addList = (name) => store.addList(name, personFilter !== 'all' ? personFilter : null);

  // ----- review, due, summary ---------------------------------------------
  const reviewTasks = useMemo(() => pastUnfinished(visibleTasks), [visibleTasks]);
  // Shown whenever earlier days left something behind; no button required.
  const showReview = dayOffset === 0 && store.loaded && !reviewDismissed && reviewTasks.length > 0;

  const todayListId = dayListIdForOffset(0);
  const dueOverdue = visibleTasks.filter((t) => t.listId !== todayListId && dueStatus(t) === 'overdue');
  const dueToday = visibleTasks.filter((t) => t.listId !== todayListId && dueStatus(t) === 'today');
  const contextFor = (t) => {
    if (isDayList(t.listId)) return describeDayKey(dayOfList(t.listId));
    return store.lists.find((l) => l.id === t.listId)?.name || null;
  };

  const daySummary = useMemo(() => {
    const { done } = tasksForList(visibleTasks, dayListId);
    if (done.length === 0) return null;
    const tracked = done.reduce((sum, t) => sum + (t.durationMs || 0), 0);
    const parts = [`${done.length} done`];
    if (tracked > 0) parts.push(`${formatDuration(tracked)} tracked`);
    return parts.join(' · ');
  }, [visibleTasks, dayListId]);

  // ----- wrap-up -----------------------------------------------------------
  const wrapUp = useMemo(() => {
    if (!wrapOpen || dayOffset !== 0) return null;
    // From the almanac day's midnight until now, so a late night still counts.
    const start = parseDayKey(today).getTime();
    const end = Date.now() + 1;
    const doneToday = visibleTasks.filter((t) => t.done && t.doneAt >= start && t.doneAt < end);
    const open = tasksForList(visibleTasks, todayListId).open;
    const routineState = { tasks: store.tasks, routineDone: store.routineDone };
    return {
      doneCount: doneToday.length,
      openCount: open.length,
      trackedMs: doneToday.reduce((s, t) => s + (t.durationMs || 0), 0),
      estimateMs: doneToday.filter((t) => t.durationMs).reduce((s, t) => s + (t.estimateMs || 0), 0),
      routines: visibleRoutines.map((r) => ({ name: r.name, ...routineProgress(r, routineState) })),
      note: store.dayNotes[today] || '',
      onChangeNote: (text) => store.setDayNote(today, text),
      onPushToTomorrow: () => store.pushOpenToTomorrow(today),
      onGoodNight: () => {
        store.endDay(today);
        setWrapOpen(false);
      },
      onClose: () => setWrapOpen(false),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wrapOpen, dayOffset, visibleTasks, visibleRoutines, store.routineDone, store.dayNotes, today]);

  const listProps = {
    tasks: visibleTasks,
    tagFor,
    onAdd: addTask,
    onToggle: store.toggleTask,
    onStart: (id) => {
      store.startTask(id);
      setFocusTaskId(id);
    },
    onPause: store.pauseTask,
    onFinish: store.finishTask,
    onDelete: store.deleteTask,
    onMove: (task) => setSheetTaskId(task.id),
    onClearCompleted: store.clearCompleted,
  };

  const personProps = {
    people: store.people,
    personFilter,
    setPersonFilter,
    onAddPerson: () => setAddingPerson(true),
    filterName,
  };

  const sheetTask = sheetTaskId ? store.tasks.find((t) => t.id === sheetTaskId) || null : null;
  const optionsList = store.lists.find((l) => l.id === optionsListId) || null;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.body}>
        {tab === 'today' && (
          <TodayScreen
            dayOffset={dayOffset}
            setDayOffset={setDayOffset}
            headerDate={headerDate}
            {...personProps}
            openDay={openDay}
            pastMidnight={pastMidnight}
            lastClosed={lastClosedDay(store.days)}
            dayLabel={parseDayKey(today).toLocaleDateString([], { weekday: 'long' })}
            onStartDay={() => {
              store.startDay(calendarToday);
              setReviewDismissed(false);
              onRefresh();
            }}
            onGoingToBed={() => setWrapOpen(true)}
            onReopenDay={(key) => store.reopenDay(key)}
            onStartFresh={() => {
              if (openKey) store.endDay(openKey);
              store.startDay(calendarToday);
              setReviewDismissed(false);
              setWrapOpen(false);
            }}
            showReview={showReview}
            reviewTasks={reviewTasks}
            onApplyReview={(carry, drop) => store.applyReview(carry, drop)}
            onLaterReview={() => setReviewDismissed(true)}
            calendar={calendar}
            onRefresh={onRefresh}
            dueOverdue={dueOverdue}
            dueToday={dueToday}
            contextFor={contextFor}
            routines={visibleRoutines}
            routineState={{ tasks: store.tasks, routineDone: store.routineDone }}
            lists={store.lists}
            onToggleRoutineItem={store.toggleRoutineItem}
            onEditRoutine={setEditingRoutine}
            dayListId={dayListId}
            daySummary={daySummary}
            wrapUp={wrapUp}
            listProps={listProps}
          />
        )}
        {tab === 'lists' && (
          <ListsScreen
            lists={visibleLists}
            allListsCount={store.lists.length}
            {...personProps}
            googleConnected={!!google.account}
            onNewList={() => setAddingList(true)}
            onListOptions={setOptionsListId}
            renamingListId={renamingListId}
            onRename={(id, name) => {
              store.renameList(id, name);
              setRenamingListId(null);
            }}
            onCancelRename={() => setRenamingListId(null)}
            routines={visibleRoutines}
            onNewRoutine={() =>
              setEditingRoutine({ personId: personFilter !== 'all' ? personFilter : 'me', items: [] })
            }
            onEditRoutine={setEditingRoutine}
            onRefresh={onRefresh}
            refreshing={sync.state === 'syncing'}
            listProps={listProps}
          />
        )}
        {tab === 'insights' && <InsightsScreen store={store} />}
        {tab === 'settings' && (
          <SettingsScreen
            google={google}
            sync={sync}
            reminderStatus={reminderStatus}
            people={store.people}
            onAddPerson={() => setAddingPerson(true)}
            sleep={sleep}
            prefs={store.prefs}
            onSetPref={store.setPref}
            canvas={canvas}
            canvasSync={canvasSync}
            canvasCourses={store.canvas?.courses || []}
            onToggleAssignmentCalendar={toggleAssignmentCalendar}
            linkedEventCount={Object.keys(store.calendarEvents || {}).length}
            onStageReview={() => {
              store.devBackdateOpenTasks();
              setReviewDismissed(false);
              setDayOffset(0);
              setTab('today');
            }}
          />
        )}
      </View>

      <TabBar active={tab} onSelect={setTab} />

      <NameModal
        visible={addingList}
        title="New list"
        hint={
          (filterName ? `This list will be for ${filterName}. ` : '') +
          "A named list for things that aren't tied to a day, like Groceries or Home. It syncs with Google Tasks when you're connected."
        }
        placeholder="List name"
        submitLabel="Create list"
        onSubmit={addList}
        onClose={() => setAddingList(false)}
      />

      <NameModal
        visible={addingPerson}
        title="Add a person"
        hint="Someone you keep track of things for. Tasks and lists can be tagged with them."
        placeholder="Name"
        submitLabel="Add"
        onSubmit={store.addPerson}
        onClose={() => setAddingPerson(false)}
      />

      <ListOptionsModal
        list={optionsList}
        people={store.people}
        onSetPerson={store.setListPerson}
        onRename={setRenamingListId}
        onDelete={store.deleteList}
        onClose={() => setOptionsListId(null)}
      />

      <RoutineEditorModal
        routine={editingRoutine}
        lists={store.lists}
        people={store.people}
        onSave={store.saveRoutine}
        onDelete={store.deleteRoutine}
        onClose={() => setEditingRoutine(null)}
      />

      <FocusModal
        task={focusTaskId ? store.tasks.find((t) => t.id === focusTaskId && !t.done && t.startedAt) || null : null}
        prefs={store.prefs}
        onPhoneFree={store.setTaskPhoneFree}
        onPause={(id) => {
          store.pauseTask(id);
          setFocusTaskId(null);
        }}
        onFinish={(id) => {
          store.finishTask(id);
          setFocusTaskId(null);
        }}
        onClose={() => setFocusTaskId(null)}
      />

      <TaskSheet
        task={sheetTask}
        lists={store.lists}
        people={store.people}
        onSetPerson={store.setTaskPerson}
        onSetDue={store.setTaskDue}
        onSetEstimate={store.setTaskEstimate}
        onMove={(id, listId) => {
          store.moveTask(id, listId);
          setSheetTaskId(null);
        }}
        onClose={() => setSheetTaskId(null)}
      />

      <StatusBar style="dark" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  body: { flex: 1 },
});
