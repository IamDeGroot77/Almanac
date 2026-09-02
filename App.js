import { StatusBar } from 'expo-status-bar';
import { Alert, StyleSheet, View, AppState } from 'react-native';
import { useEffect, useRef, useState } from 'react';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { colors } from './src/theme';
import { almanacDayFromOffset } from './src/clock';
import { useAlmanacStore } from './src/store';
import useAlmanacDay from './src/hooks/useAlmanacDay';
import usePeopleFilter from './src/hooks/usePeopleFilter';
import useTodayDerived from './src/hooks/useTodayDerived';
import useCalendarEvents from './src/useCalendarEvents';
import useTaskReminders from './src/reminders';
import { scheduleDailyReminder } from './src/notifications';
import { useNotificationRouter } from './src/notificationRouter';
import { useGoogleAuth } from './src/google/auth';
import useGoogleSync from './src/google/useGoogleSync';
import useDriveSync from './src/drive/useDriveSync';
import { useSleepDetection } from './src/sleep';
import { useCanvasAuth } from './src/canvas/auth';
import useCanvasSync from './src/canvas/useCanvasSync';
import useAssignmentCalendar from './src/assignmentCalendar';
import { useQuickAdd } from './src/quickAdd';
import useTaskCheckins from './src/checkins';
import useEnergyCheckins from './src/energy';
import useDayBracketNotifications, { DEFAULT_BEDTIME_HOUR } from './src/dayBracket';
import { planAutoStart, describeAutoStart } from './src/dayAuto';
import useUndo from './src/hooks/useUndo';
import UndoBar from './src/components/UndoBar';
import { pickNext, nextStepOf, childrenOf } from './src/pickNext';
import { suggestSteps, planDates } from './src/breakdown';
import { useWeather } from './src/weather';
import useFocusSession from './src/focusSession';
import { maybeReward } from './src/rewards';
import Toast from './src/components/Toast';
import { useWeeklyLetterReminder } from './src/weeklyLetter';
import { estimateAccuracy } from './src/insights';

import TabBar from './src/components/TabBar';
import TodayScreen from './src/screens/TodayScreen';
import ListsScreen from './src/screens/ListsScreen';
import InsightsScreen from './src/screens/InsightsScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import PlannerScreen from './src/screens/web/PlannerScreen';
import SemesterScreen from './src/screens/web/SemesterScreen';
import CalendarScreen from './src/screens/web/CalendarScreen';
import FilesScreen from './src/screens/web/FilesScreen';
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
  // ----- data and the day ----------------------------------------------------
  const store = useAlmanacStore();
  const day = useAlmanacDay(store);
  const people = usePeopleFilter(store);
  const [tab, setTab] = useState('today');
  const [dayOffset, setDayOffset] = useState(0); // 0 = today, 1 = tomorrow
  const derived = useTodayDerived({
    store,
    visibleTasks: people.visibleTasks,
    visibleRoutines: people.visibleRoutines,
    dayOffset,
    today: day.today,
  });

  // ----- integrations ---------------------------------------------------------
  const calendar = useCalendarEvents(dayOffset, day.today);
  const google = useGoogleAuth();
  const sync = useGoogleSync(store, google);
  const drive = useDriveSync(store, google);
  const canvas = useCanvasAuth();
  const canvasSync = useCanvasSync(store, canvas);
  const assignmentCalendar = useAssignmentCalendar(store, {
    enabled: !!store.prefs.assignmentsToCalendar && canvas.connected,
    calendarId: store.prefs.assignmentCalendarId,
  });
  const sleep = useSleepDetection(store);
  const weather = useWeather(store.prefs.weatherPlace || null);
  const [nowMode, setNowMode] = useState(false);
  // The app's own usage record, and the "one thing on screen" default: when
  // today has more than a handful open, start in Now mode.
  // Start of day happens by itself: the first open after a clear stretch of
  // sleep closes any stale day, opens today, and brings the review.
  const storeRef = useRef(store);
  storeRef.current = store;
  const onAppOpen = () => {
    const s = storeRef.current;
    const plan = planAutoStart(s, Date.now());
    if (plan) {
      s.applyAutoStart(plan);
      setReviewDismissed(false);
      setWrapOpen(false);
      setDayOffset(0);
      setToast({ text: describeAutoStart(plan), at: Date.now() });
      onRefresh();
    }
    s.noteAppOpen();
  };
  const onAppOpenRef = useRef(onAppOpen);
  onAppOpenRef.current = onAppOpen;
  useEffect(() => {
    if (!store.loaded) return;
    onAppOpenRef.current();
    const openToday = store.tasks.filter((t) => !t.done && !t.parentId && t.listId === `day:${day.today}`).length;
    if (openToday > 5) setNowMode(true);
    const sub = AppState.addEventListener('change', (st) => st === 'active' && onAppOpenRef.current());
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.loaded]);

  // ----- notifications --------------------------------------------------------
  useNotificationRouter(store.loaded);
  useTaskReminders(store.tasks, store.loaded);
  useQuickAdd(store, { enabled: !!store.prefs.quickAddNotification });
  useTaskCheckins(store, { minutes: store.prefs.checkinMinutes ?? 30 });
  useEnergyCheckins(store, { enabled: store.prefs.energyCheckins !== false });
  const justOneRef = useRef(null);
  useDayBracketNotifications(store, { bedtimeHour: store.prefs.bedtimeHour ?? DEFAULT_BEDTIME_HOUR, onJustOneThing: () => justOneRef.current?.() });
  const { undo, offer: offerUndo } = useUndo();
  const focusSession = useFocusSession();
  const [toast, setToast] = useState(null);
  useWeeklyLetterReminder(store.prefs.weeklyLetter !== false);
  const [reminderStatus, setReminderStatus] = useState('pending');
  useEffect(() => {
    scheduleDailyReminder()
      .then(setReminderStatus)
      .catch((err) => {
        console.warn('Reminder setup failed', err);
        setReminderStatus('error');
      });
  }, []);

  // ----- transient UI state ---------------------------------------------------
  const [focusTaskId, setFocusTaskId] = useState(null);
  const [reviewDismissed, setReviewDismissed] = useState(false);
  const [wrapOpen, setWrapOpen] = useState(false);
  const [sheetTaskId, setSheetTaskId] = useState(null);
  const [optionsListId, setOptionsListId] = useState(null);
  const [renamingListId, setRenamingListId] = useState(null);
  const [addingList, setAddingList] = useState(false);
  const [addingPerson, setAddingPerson] = useState(false);
  const [editingRoutine, setEditingRoutine] = useState(null); // null | {} (new) | routine

  const onRefresh = async () => {
    await Promise.all([calendar.refresh(), sync.syncNow(), canvasSync.syncNow(), drive.syncNow(), weather.refresh({ force: true })]);
  };

  const showReview = dayOffset === 0 && store.loaded && !reviewDismissed && derived.reviewTasks.length > 0;

  const wrapUp =
    wrapOpen && dayOffset === 0
      ? {
          ...derived.wrapUpStats,
          note: store.dayNotes[day.today] || '',
          onChangeNote: (text) => store.setDayNote(day.today, text),
          onPushToTomorrow: () => store.pushOpenToTomorrow(day.today),
          onGoodNight: () => {
            store.endDay(day.today);
            setWrapOpen(false);
          },
          onClose: () => setWrapOpen(false),
          energy: store.days[day.today]?.energy || null,
          onEnergy: (slot, value) => store.setEnergy(day.today, slot, value),
        }
      : null;

  // Finishing the last step offers to finish the parent too.
  const finishTask = (id) => {
    const before = store.tasks.find((t) => t.id === id);
    const { parentReady } = store.finishTask(id);
    if (before) {
      const spent = (before.spentMs || 0) + (before.startedAt ? Date.now() - before.startedAt : 0);
      const line = maybeReward({
        durationMs: spent || null,
        estimateMs: before.estimateMs,
        carriedCount: before.carriedCount,
        isStep: !!before.parentId,
      });
      if (line) setToast({ text: line, at: Date.now() });
    }
    if (focusSession.session?.taskId === id) focusSession.clear();
    if (!parentReady) return;
    const parent = store.tasks.find((t) => t.id === parentReady);
    if (!parent) return;
    Alert.alert('All steps done', `Finish "${parent.text}" too?`, [
      { text: 'Not yet', style: 'cancel' },
      { text: 'Finish it', onPress: () => store.finishTask(parentReady) },
    ]);
  };

  // "Break it down": starter steps, dated back from the deadline when there is one.
  const breakDown = (taskId) => {
    const task = store.tasks.find((t) => t.id === taskId);
    if (!task) return;
    const steps = suggestSteps(task.text);
    const dates = planDates(steps.length, task.due);
    steps.forEach((text, i) => store.addStep(taskId, text, dates[i]));
  };

  // "Just one thing": pick the next task worth starting and open Focus on it.
  const justOneThing = () => {
    const running = store.tasks.filter((t) => !t.done && t.startedAt).map((t) => t.id);
    const pick = pickNext(people.visibleTasks, { running });
    if (!pick) return;
    store.startTask(pick.id);
    setFocusTaskId(pick.id);
  };
  justOneRef.current = justOneThing;

  const listProps = {
    tasks: people.visibleTasks,
    tagFor: people.tagFor,
    onAdd: people.addTask,
    onToggle: store.toggleTask,
    onStart: (id) => {
      store.startTask(id);
      setFocusTaskId(id);
    },
    onPause: store.pauseTask,
    onFinish: finishTask,
    onDelete: (id) => {
      const removed = store.deleteTask(id);
      if (removed) offerUndo(`Deleted "${removed.text}"`, () => store.restoreTasks([removed]));
    },
    onMove: (task) => setSheetTaskId(task.id),
    onClearCompleted: (listId) => {
      const removed = store.clearCompleted(listId);
      if (removed.length) offerUndo(`Cleared ${removed.length} done`, () => store.restoreTasks(removed));
    },
  };

  const personProps = {
    people: store.people,
    personFilter: people.personFilter,
    setPersonFilter: people.setPersonFilter,
    onAddPerson: () => setAddingPerson(true),
    filterName: people.filterName,
  };

  const sheetTask = sheetTaskId ? store.tasks.find((t) => t.id === sheetTaskId) || null : null;
  const focusTask = focusTaskId ? store.tasks.find((t) => t.id === focusTaskId && !t.done && t.startedAt) || null : null;
  const optionsList = store.lists.find((l) => l.id === optionsListId) || null;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.body}>
        {tab === 'today' && (
          <TodayScreen
            dayOffset={dayOffset}
            setDayOffset={setDayOffset}
            headerDate={almanacDayFromOffset(dayOffset)}
            {...personProps}
            openDay={day.openDay}
            pastMidnight={day.pastMidnight}
            lastClosed={day.lastClosed}
            dayLabel={day.dayLabel}
            onStartDay={() => {
              store.startDay(day.calendarToday);
              setReviewDismissed(false);
              onRefresh();
            }}
            onGoingToBed={() => setWrapOpen(true)}
            onReopenDay={(key) => store.reopenDay(key)}
            energy={store.days[day.today]?.energy || null}
            onEnergy={(slot, value) => store.setEnergy(day.today, slot, value)}
            onStartFresh={() => {
              if (day.openKey) store.endDay(day.openKey);
              store.startDay(day.calendarToday);
              setReviewDismissed(false);
              setWrapOpen(false);
            }}
            showReview={showReview}
            reviewTasks={derived.reviewTasks}
            onApplyReview={(carry, drop) => store.applyReview(carry, drop)}
            onLaterReview={() => setReviewDismissed(true)}
            calendar={calendar}
            onRefresh={onRefresh}
            dueOverdue={derived.dueOverdue}
            dueToday={derived.dueToday}
            contextFor={derived.contextFor}
            routines={people.visibleRoutines}
            routineState={{ tasks: store.tasks, routineDone: store.routineDone }}
            lists={store.lists}
            onToggleRoutineItem={store.toggleRoutineItem}
            onEditRoutine={setEditingRoutine}
            dayListId={derived.dayListId}
            daySummary={derived.daySummary}
            wrapUp={wrapUp}
            onJustOneThing={justOneThing}
            listProps={listProps}
            forecast={weather.forecast}
            nowMode={nowMode}
            setNowMode={setNowMode}
            allTasks={people.visibleTasks}
          />
        )}
        {tab === 'lists' && (
          <ListsScreen
            lists={people.visibleLists}
            allLists={store.lists}
            allListsCount={store.lists.length}
            allTasks={people.visibleTasks}
            contextFor={derived.contextFor}
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
            routines={people.visibleRoutines}
            onNewRoutine={() => setEditingRoutine({ personId: people.defaultPerson, items: [] })}
            onEditRoutine={setEditingRoutine}
            onRefresh={onRefresh}
            refreshing={sync.state === 'syncing'}
            listProps={listProps}
            google={google}
          />
        )}
        {tab === 'insights' && <InsightsScreen store={store} />}
        {tab === 'planner' && (
          <PlannerScreen
            store={store}
            people={people}
            events={[]}
            forecast={weather.forecast}
            onOpenTask={(task) => setSheetTaskId(task.id)}
            onStart={(id) => {
              store.startTask(id);
              setFocusTaskId(id);
            }}
          />
        )}
        {tab === 'semester' && <SemesterScreen store={store} onOpenTask={(task) => setSheetTaskId(task.id)} />}
        {tab === 'calendar' && <CalendarScreen store={store} google={google} onOpenTask={(task) => setSheetTaskId(task.id)} />}
        {tab === 'files' && <FilesScreen google={google} />}
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
            onToggleAssignmentCalendar={async (on) => {
              store.setPref('assignmentsToCalendar', on);
              if (!on) await assignmentCalendar.removeAll();
            }}
            linkedEventCount={Object.keys(store.calendarEvents || {}).length}
            weather={weather}
            drive={drive}
            onStageReview={() => {
              store.devBackdateOpenTasks();
              setReviewDismissed(false);
              setDayOffset(0);
              setTab('today');
            }}
          />
        )}
      </View>

      <UndoBar undo={undo} />
      <Toast toast={toast} />
      <TabBar active={tab} onSelect={setTab} />

      <NameModal
        visible={addingList}
        title="New list"
        hint={
          (people.filterName ? `This list will be for ${people.filterName}. ` : '') +
          "A named list for things that aren't tied to a day, like Groceries or Home. It syncs with Google Tasks when you're connected."
        }
        placeholder="List name"
        submitLabel="Create list"
        onSubmit={people.addList}
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
        task={focusTask}
        nextStep={focusTask ? nextStepOf(store.tasks, focusTask.id) : null}
        stepsSummary={
          focusTask && childrenOf(store.tasks, focusTask.id).all.length
            ? `${childrenOf(store.tasks, focusTask.id).done.length}/${childrenOf(store.tasks, focusTask.id).all.length} steps`
            : null
        }
        onFinishStep={(stepId) => store.finishTask(stepId)}
        session={focusSession.session}
        onStartSession={focusSession.start}
        onEndSession={focusSession.clear}
        onFocusmate={focusSession.openFocusmate}
        prefs={store.prefs}
        onPhoneFree={store.setTaskPhoneFree}
        onPause={(id) => {
          store.pauseTask(id);
          setFocusTaskId(null);
        }}
        onFinish={(id) => {
          finishTask(id);
          setFocusTaskId(null);
        }}
        onClose={() => setFocusTaskId(null)}
      />
      <TaskSheet
        steps={sheetTask ? childrenOf(store.tasks, sheetTask.id) : null}
        onAddStep={store.addStep}
        onBreakDown={breakDown}
        onToggleStep={store.toggleTask}
        onDeleteStep={(id) => store.deleteTask(id)}
        task={sheetTask}
        lists={store.lists}
        people={store.people}
        onSetPerson={store.setTaskPerson}
        onSetDue={store.setTaskDue}
        onSetEstimate={store.setTaskEstimate}
        onSetNotes={store.setTaskNotes}
        onSetPlan={store.setTaskPlan}
        calibration={estimateAccuracy(store.timeLog)?.median || null}
        onMove={(id, listId) => {
          store.moveTask(id, listId);
          setSheetTaskId(null);
        }}
        onClose={() => setSheetTaskId(null)}
      />

      <StatusBar style={colors.scheme === 'dark' ? 'light' : 'dark'} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  body: { flex: 1 },
});
