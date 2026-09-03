import { StatusBar } from 'expo-status-bar';
import { Alert, StyleSheet, View, AppState, TouchableOpacity, Text } from 'react-native';
import { useEffect, useRef, useState } from 'react';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { colors } from './src/theme';
import { almanacDayFromOffset, almanacDayKeyFromOffset } from './src/clock';
import { useAlmanacStore } from './src/store';
import useAlmanacDay from './src/hooks/useAlmanacDay';
import usePeopleFilter from './src/hooks/usePeopleFilter';
import useTodayDerived from './src/hooks/useTodayDerived';
import useCalendarEvents from './src/useCalendarEvents';
import useTaskReminders from './src/reminders';
import { scheduleMorningBrief, sendBriefIfDue, briefDeliveredToday } from './src/notifications';
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
import { considerations } from './src/consider';
import { newlyEarned, ACHIEVEMENTS } from './src/achievements';
import { currentBlock, nextBlock, categoryTasks, colorForCategory, blocksForDay } from './src/blocks';
import * as IntentLauncher from 'expo-intent-launcher';
import { APP_CATALOG } from './src/apps';
import { isWeb } from './src/platform';
import { formatDuration } from './src/durations';
import useCalendarRules from './src/useCalendarRules';
import { dayListId } from './src/store';
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
import JournalScreen from './src/screens/JournalScreen';
import HomeScreen from './src/screens/HomeScreen';
import YouScreen from './src/screens/YouScreen';
import ErrorBoundary from './src/components/ErrorBoundary';
import { quoteOfDay, parseQuotes } from './src/quotes';
import { useArt } from './src/art';
import useQuickActions from './src/quickActions';
import useJournalLock from './src/journalLock';
import { refreshWidgetSafe } from './src/widget/bridge';
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

// What the Today screen needs to draw the current block and its picks.
function blockInfoFor(store, block, candidates) {
  const blocks = store.prefs.dayBlocks || [];
  if (!blocks.length) return null;
  const categories = store.categories || [];
  const now = Date.now();
  const next = nextBlock(blocks, now);
  const running = store.tasks.filter((t) => !t.done && t.startedAt).map((t) => t.id);
  const picks = [];
  let pool = candidates;
  while (block && picks.length < 3) {
    const p = pickNext(pool, { running: [...running, ...picks.map((t) => t.id)] });
    if (!p) break;
    picks.push(p);
    pool = pool.filter((t) => t.id !== p.id);
  }
  return {
    current: block,
    next,
    category: block ? categories.find((c) => c.id === block.categoryId) : null,
    nextCategory: next ? categories.find((c) => c.id === next.categoryId) : null,
    color: block ? colorForCategory(categories, block.categoryId) : null,
    colorFor: (id) => colorForCategory(categories, id),
    dayBlocks: blocksForDay(blocks, new Date(now)),
    picks,
  };
}

function AlmanacApp() {
  // ----- data and the day ----------------------------------------------------
  const store = useAlmanacStore();
  const day = useAlmanacDay(store);
  const people = usePeopleFilter(store);
  const [tab, setTab] = useState('home');
  // On the laptop the Calendar tab holds Today, Week, Month, and Semester.
  const [calView, setCalView] = useState(() => {
    try {
      return (isWeb && globalThis.localStorage?.getItem('almanac:calView')) || 'today';
    } catch {
      return 'today';
    }
  });
  const pickCalView = (v) => {
    setCalView(v);
    try {
      globalThis.localStorage?.setItem('almanac:calView', v);
    } catch {}
  };
  const go = (id) => {
    if (isWeb && (id === 'today' || id === 'planner' || id === 'semester' || id === 'month')) {
      pickCalView(id === 'month' ? 'calendar' : id);
      setTab('calendar');
    } else if (!isWeb && (id === 'insights' || id === 'settings')) {
      setYouView(id);
      setTab('you');
    } else setTab(id);
  };
  const [youView, setYouView] = useState('insights');
  const view = isWeb && tab === 'calendar' ? calView : tab;
  const [journalPrompt, setJournalPrompt] = useState(null);
  const journalLock = useJournalLock(!isWeb && !!store.prefs.journalLock);
  useEffect(() => {
    if (tab === 'journal' && !journalLock.unlocked && !journalLock.busy) journalLock.unlock();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, journalLock.unlocked]);
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
  const [reminderStatus, setReminderStatus] = useState({ mode: 'pending' });
  const briefRef = useRef(reminderStatus);
  briefRef.current = reminderStatus;
  const prefsRef = useRef(store.prefs);
  prefsRef.current = store.prefs;
  const refreshBrief = () =>
    scheduleMorningBrief({ wakeTarget: prefsRef.current?.wakeTarget || null })
      .then((st) => {
        briefRef.current = st;
        setReminderStatus(st);
      })
      .catch((err) => {
        console.warn('Brief setup failed', err);
        setReminderStatus({ mode: 'error' });
      });
  useEffect(() => {
    refreshBrief();
    const sub = AppState.addEventListener('change', () => refreshBrief());
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.prefs.wakeTarget]);

  const storeRef = useRef(store);
  storeRef.current = store;
  const onAppOpen = () => {
    const s = storeRef.current;
    if (s.routineActive) {
      const entry = s.finishRoutineItem();
      if (entry && !entry.skipped) setToast({ text: `${entry.text}: ${formatDuration(entry.durationMs) || '1m'} logged.`, at: Date.now() });
      else if (entry?.skipped) setToast({ text: entry.durationMs < 60000 ? `${entry.text}: under a minute, nothing logged.` : `${entry.text}: timer ran too long, nothing logged.`, at: Date.now() });
    }
    const plan = isWeb ? null : planAutoStart(s, Date.now()); // sensors live on the phone
    if (plan) {
      s.applyAutoStart(plan);
      setReviewDismissed(false);
      setWrapOpen(false);
      setDayOffset(0);
      setToast({ text: describeAutoStart(plan), at: Date.now() });
      onRefresh();
      if (!briefDeliveredToday(briefRef.current)) sendBriefIfDue().catch(() => {});
    }
    s.noteAppOpen();
  };
  const onAppOpenRef = useRef(onAppOpen);
  onAppOpenRef.current = onAppOpen;
  useEffect(() => {
    if (!store.loaded) return;
    onAppOpenRef.current();
    const openToday = store.tasks.filter((t) => !t.done && !t.parentId && t.listId === `day:${day.today}`).length;
    if (openToday >= 3) setNowMode(true);
    const sub = AppState.addEventListener('change', (st) => st === 'active' && onAppOpenRef.current());
    // auto-start tick: while the app stays open across a night, the day still rolls over.
    const tick = setInterval(() => onAppOpenRef.current(), 5 * 60 * 1000);
    return () => {
      sub.remove();
      clearInterval(tick);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.loaded]);

  // ----- notifications --------------------------------------------------------
  useNotificationRouter(store.loaded);
  useTaskReminders(store.tasks, store.loaded);
  useQuickAdd(store, { enabled: !!store.prefs.quickAddNotification });
  useTaskCheckins(store, { minutes: store.prefs.checkinMinutes ?? 30 });
  useEnergyCheckins(store, { enabled: store.prefs.energyCheckins === true }); // off unless asked for
  const importPlanWithToast = (plan) => {
    const added = store.importPlan(plan);
    const bits = [];
    if (added.tasks) bits.push(`${added.tasks} ${added.tasks === 1 ? 'task' : 'tasks'}`);
    if (added.lists) bits.push(`${added.lists} new ${added.lists === 1 ? 'list' : 'lists'}`);
    if (added.routines) bits.push(`${added.routines} new ${added.routines === 1 ? 'routine' : 'routines'}`);
    if (added.categories) bits.push(`${added.categories} new ${added.categories === 1 ? 'category' : 'categories'}`);
    setToast({ text: bits.length ? `Added ${bits.join(', ')}.` : 'Nothing new to add (everything was already there).', at: Date.now() });
  };
  const justOneRef = useRef(null);
  // Icon shortcuts.
  useQuickActions((go) => {
    if (go === 'one') justOneRef.current?.();
    else if (go === 'hold') {
      setTab('home');
      setToast({ text: 'Hold it in working memory below.', at: Date.now() });
    } else if (go === 'journal') setTab('journal');
  });
  // Home-screen widget follows the state.
  useEffect(() => {
    if (!store.loaded) return;
    refreshWidgetSafe(store);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.loaded, store.localVersion, store.days]);
  const lastAchievementCheck = useRef(0);
  useCalendarRules(store);
  // Achievements: check after edits settle, award, and say so once.
  useEffect(() => {
    if (!store.loaded) return;
    if (Date.now() - lastAchievementCheck.current < 60000) return;
    const t = setTimeout(() => {
      lastAchievementCheck.current = Date.now();
      const ids = newlyEarned(store);
      if (!ids.length) return;
      store.awardAchievements(ids);
      const first = ACHIEVEMENTS.find((a) => a.id === ids[0]);
      setToast({ text: `★ ${first?.name || 'Achievement'}${ids.length > 1 ? ` and ${ids.length - 1} more` : ''}. ${first?.blurb || ''}`, at: Date.now() });
    }, 1500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.loaded, store.localVersion]);
  useDayBracketNotifications(store, { bedtimeHour: store.prefs.bedtimeHour ?? DEFAULT_BEDTIME_HOUR, onJustOneThing: () => justOneRef.current?.() });
  const { undo, offer: offerUndo } = useUndo();
  const focusSession = useFocusSession();
  const [toast, setToast] = useState(null);
  useWeeklyLetterReminder(store.prefs.weeklyLetter !== false, store);

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
          tomorrowOptions: [...store.tasks.filter((t) => !t.done && !t.parentId && t.listId === dayListId(almanacDayKeyFromOffset(1))), ...derived.wrapUpStats.openTasks].filter((t, i, arr) => arr.findIndex((x) => x.id === t.id) === i),
          oneThing: store.days[almanacDayKeyFromOffset(1)]?.oneThing || null,
          onPickOneThing: (id) => store.setOneThing(almanacDayKeyFromOffset(1), id),
          onCarry: (id) => store.moveTask(id, dayListId(almanacDayKeyFromOffset(1))),
          onNextWeek: (id) => store.moveTask(id, dayListId(almanacDayKeyFromOffset(7))),
          onDrop: (id) => {
            const removed = store.deleteTask(id);
            if (removed) offerUndo('Dropped ' + JSON.stringify(removed.text), () => store.restoreTasks([removed]));
          },
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
  const timerApp = APP_CATALOG.find((a) => a.id === store.prefs.timerApp) || null;
  const art = useArt(google.account, day.today);
  const oneThing = store.tasks.find((t) => t.id === store.days[day.today]?.oneThing && !t.done) || null;
  const block = currentBlock(store.prefs.dayBlocks, Date.now());
  const blockPicksAll = block ? categoryTasks(people.visibleTasks, store.lists, block.categoryId) : [];
  const justOneThing = () => {
    const running = store.tasks.filter((t) => !t.done && t.startedAt).map((t) => t.id);
    const pick = (blockPicksAll.length ? pickNext(blockPicksAll, { running }) : null) || pickNext(people.visibleTasks, { running });
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

  const settingsProps = {
    google,
    sync,
    reminderStatus,
    lists: store.lists,
    categories: store.categories || [],
    onAddCategory: store.addCategory,
    onRenameCategory: store.renameCategory,
    onDeleteCategory: store.deleteCategory,
    people: store.people,
    onAddPerson: () => setAddingPerson(true),
    sleep,
    prefs: store.prefs,
    onSetPref: store.setPref,
    canvas,
    canvasSync,
    canvasCourses: store.canvas?.courses || [],
    onToggleAssignmentCalendar: async (on) => {
      store.setPref('assignmentsToCalendar', on);
      if (!on) await assignmentCalendar.removeAll();
    },
    linkedEventCount: Object.keys(store.calendarEvents || {}).length,
    weather,
    drive,
    onStageReview: () => {
      store.devBackdateOpenTasks();
      setReviewDismissed(false);
      setDayOffset(0);
      setTab('today');
    },
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.body}>
        <ErrorBoundary key={tab} name={tab}>
        {tab === 'home' && (
          <HomeScreen
            store={store}
            today={day.today}
            headerDate={almanacDayFromOffset(0)}
            forecast={weather.forecast}
            art={art}
            quote={quoteOfDay(day.today, parseQuotes(store.prefs.quotes))}
            running={store.tasks.find((t) => !t.done && t.startedAt) || null}
            blockInfo={blockInfoFor(store, block, blockPicksAll)}
            pinned={!!oneThing}
            restDay={!!store.days[day.today]?.rest}
            onReplan={() => {
              const moved = store.replanRestOfToday(day.today, { bedtimeHour: store.prefs.bedtimeHour ?? 23 });
              if (!moved.length) return setToast({ text: 'Nothing safe to move; everything left is due today or already started.', at: Date.now() });
              offerUndo(`Moved ${moved.length} to tomorrow`, () => moved.forEach((id) => store.moveTask(id, dayListId(day.today))));
              setToast({ text: `Moved ${moved.length} ${moved.length === 1 ? 'task' : 'tasks'} to tomorrow. Today fits now.`, at: Date.now() });
            }}
            nextPick={oneThing || (blockPicksAll.length ? pickNext(blockPicksAll, { running: store.tasks.filter((t) => !t.done && t.startedAt).map((t) => t.id) }) : null) || pickNext(people.visibleTasks, { running: store.tasks.filter((t) => !t.done && t.startedAt).map((t) => t.id) })}
            openToday={store.tasks.filter((t) => !t.done && !t.parentId && t.listId === dayListId(day.today)).length}
            doneToday={derived.wrapUpStats.doneCount}
            capacity={derived.capacity}
            scratch={store.scratch || []}
            scratchActions={{
              onAdd: (text) => store.addScratch(text),
              onEdit: store.editScratch,
              onRemove: store.removeScratch,
              onClearStale: store.clearStaleScratch,
              onToTask: (id) => {
                const n = (store.scratch || []).find((x) => x.id === id);
                if (!n) return;
                store.addTask(n.text, dayListId(day.today));
                store.removeScratch(id);
                setToast({ text: "Moved to today's tasks.", at: Date.now() });
              },
              onToJournal: (id) => {
                const n = (store.scratch || []).find((x) => x.id === id);
                if (!n) return;
                store.addJournalEntry(n.text, { source: 'scratch' });
                store.removeScratch(id);
                setToast({ text: 'Saved to the journal.', at: Date.now() });
              },
            }}
            onStart={(id) => {
              store.startTask(id);
              setFocusTaskId(id);
            }}
            onFinish={finishTask}
            onOpenTask={(task) => setSheetTaskId(task.id)}
            onJustOneThing={justOneThing}
            onGo={go}
            review={{ show: showReview, tasks: derived.reviewTasks, tagFor: people.tagFor, onApply: (carry, drop) => store.applyReview(carry, drop), onLater: () => setReviewDismissed(true) }}
            importProps={{ people: store.people, lists: store.lists, routines: store.routines, categories: store.categories || [], onImport: importPlanWithToast }}
          />
        )}
        {isWeb && tab === 'calendar' ? (
          <CalendarViewSwitch value={calView} onChange={pickCalView} />
        ) : null}
        {view === 'today' && (
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
            routineState={{ tasks: store.tasks, routineDone: store.routineDone, routineLog: store.routineLog || [] }}
            lists={store.lists}
            onToggleRoutineItem={store.toggleRoutineItem}
            onEditRoutine={setEditingRoutine}
            dayListId={derived.dayListId}
            daySummary={derived.daySummary}
            capacity={store.days[day.today]?.rest ? null : derived.capacity}
            restDay={!!store.days[day.today]?.rest}
            onToggleRestDay={() => store.toggleRestDay(day.today)}
            onSkipRoutineItem={store.skipRoutineItem}
            dopamenu={store.prefs.dopamenu || []}
            onDopamenuDid={(m) => setToast({ text: `${m.text}. Good.`, at: Date.now() })}
            wrapUp={wrapUp}
            onJustOneThing={justOneThing}
            listProps={listProps}
            forecast={weather.forecast}
            nowMode={nowMode}
            setNowMode={setNowMode}
            allTasks={people.visibleTasks}
            considerations={considerations({ ...store, tasks: people.visibleTasks })}
            onConsiderToday={(id) => store.moveTask(id, dayListId(day.today))}
            onConsiderLater={(id) => store.snoozeConsideration(id)}
            allRoutines={store.routines}
            blockInfo={blockInfoFor(store, block, blockPicksAll)}
            scratch={store.scratch || []}
            scratchActions={{
              onAdd: (text) => store.addScratch(text),
              onEdit: store.editScratch,
              onRemove: store.removeScratch,
              onClearStale: store.clearStaleScratch,
              onToTask: (id) => {
                const n = (store.scratch || []).find((x) => x.id === id);
                if (!n) return;
                store.addTask(n.text, dayListId(day.today));
                store.removeScratch(id);
                setToast({ text: 'Moved to today\'s tasks.', at: Date.now() });
              },
              onToJournal: (id) => {
                const n = (store.scratch || []).find((x) => x.id === id);
                if (!n) return;
                store.addJournalEntry(n.text, { source: 'scratch' });
                store.removeScratch(id);
                setToast({ text: 'Saved to the journal.', at: Date.now() });
              },
            }}
            routineActive={store.routineActive}
            timerAppName={timerApp?.name || null}
            onStartRoutineItem={(routineId, itemId, text) => {
              store.startRoutineItem(routineId, itemId, text);
              if (timerApp && !isWeb) {
                try {
                  IntentLauncher.openApplication(timerApp.package);
                  setToast({ text: `${text} started. Come back to Almanac when you stop and the time is logged.`, at: Date.now() });
                } catch {
                  setToast({ text: `${text} started. Tap Done when you stop.`, at: Date.now() });
                }
              } else {
                setToast({ text: `${text} started. Tap Done when you stop.`, at: Date.now() });
              }
            }}
            onFinishRoutineItem={() => {
              const entry = store.finishRoutineItem({ minMs: 0 });
              if (entry && !entry.skipped) setToast({ text: `${entry.text}: ${formatDuration(entry.durationMs) || '1m'} logged.`, at: Date.now() });
            }}
            onCancelRoutineItem={() => store.cancelRoutineItem()}
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
            allRoutines={store.routines}
            categories={store.categories || []}
            diag={!!store.prefs.listsDiag}
            onImport={importPlanWithToast}
          />
        )}
        {tab === 'journal' && !journalLock.unlocked && (
          <View style={styles.locked}>
            <Text style={styles.lockedTitle}>Journal is locked.</Text>
            <TouchableOpacity style={styles.lockedButton} onPress={journalLock.unlock} accessibilityRole="button">
              <Text style={styles.lockedButtonText}>{journalLock.busy ? 'Checking…' : 'Unlock'}</Text>
            </TouchableOpacity>
          </View>
        )}
        {tab === 'journal' && journalLock.unlocked && (
          <JournalScreen
            journal={store.journal || {}}
            dayNotes={store.dayNotes}
            onAdd={(text, opts) => store.addJournalEntry(text, opts)}
            onEdit={store.editJournalEntry}
            onDelete={store.deleteJournalEntry}
            initialPrompt={journalPrompt}
            onPromptUsed={() => setJournalPrompt(null)}
          />
        )}
        {view === 'insights' && <InsightsScreen store={store} />}
        {tab === 'you' && <YouScreen key={youView} initial={youView} insightsProps={{ store }} settingsProps={settingsProps} />}
        {view === 'planner' && (
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
        {view === 'semester' && <SemesterScreen store={store} onOpenTask={(task) => setSheetTaskId(task.id)} />}
        {view === 'calendar' && <CalendarScreen store={store} google={google} onOpenTask={(task) => setSheetTaskId(task.id)} />}
        {tab === 'files' && <FilesScreen google={google} />}
        {view === 'settings' && <SettingsScreen {...settingsProps} />}
        </ErrorBoundary>
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
        onSetHorizon={store.setListHorizon}
        onSetCategory={store.setListCategory}
        categories={store.categories || []}
        onRename={setRenamingListId}
        onDelete={store.deleteList}
        onClose={() => setOptionsListId(null)}
      />
      <RoutineEditorModal
        routine={editingRoutine}
        lists={store.lists}
        routines={store.routines}
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
        onSetFirstStep={store.setTaskFirstStep}
        onSetSlot={store.setTaskSlot}
        onStuck={store.setTaskStuck}
        stuckActions={{
          startFirstStep: (task) => {
            setSheetTaskId(null);
            store.startTask(task.id);
            setFocusTaskId(task.id);
            setToast({ text: task.firstStep ? `Just this: ${task.firstStep}` : 'Two minutes. Then you can stop.', at: Date.now() });
          },
          moveTomorrow: (task) => {
            store.moveTask(task.id, dayListId(almanacDayKeyFromOffset(1)));
            setSheetTaskId(null);
            setToast({ text: 'Moved to tomorrow. Today is allowed to be smaller.', at: Date.now() });
          },
          focusFirstStep: () => setToast({ text: 'Fill in "First two-minute step" above.', at: Date.now() }),
          focusPlan: () => setToast({ text: 'Fill in "When and where" above.', at: Date.now() }),
          journal: (task) => {
            setSheetTaskId(null);
            setJournalPrompt(`What am I avoiding about: ${task.text}?`);
            setTab('journal');
          },
        }}
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
  locked: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  lockedTitle: { fontSize: 18, fontWeight: '700', color: colors.ink },
  lockedButton: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 999, backgroundColor: colors.accent },
  lockedButtonText: { color: colors.onAccent, fontWeight: '700' },
  safe: { flex: 1, backgroundColor: colors.bg },
  body: { flex: 1 },
});

// Laptop only: Today / Week / Month / Semester inside the Calendar tab.
function CalendarViewSwitch({ value, onChange }) {
  const views = [
    { id: 'today', label: 'Today' },
    { id: 'planner', label: 'Week' },
    { id: 'calendar', label: 'Month' },
    { id: 'semester', label: 'Semester' },
  ];
  return (
    <View style={switchStyles.wrap}>
      {views.map((v) => (
        <TouchableOpacity key={v.id} onPress={() => onChange(v.id)} style={[switchStyles.item, value === v.id && switchStyles.itemOn]} accessibilityRole="tab" accessibilityState={{ selected: value === v.id }}>
          <Text style={[switchStyles.text, value === v.id && switchStyles.textOn]}>{v.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}
const switchStyles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignSelf: 'center', gap: 4, marginTop: 10, padding: 3, borderRadius: 999, backgroundColor: colors.accentSoft },
  item: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999 },
  itemOn: { backgroundColor: colors.bg },
  text: { fontSize: 13, fontWeight: '600', color: colors.muted },
  textOn: { color: colors.ink },
});
