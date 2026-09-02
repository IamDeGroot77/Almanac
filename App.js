import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';
import { useEffect, useMemo, useState } from 'react';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { colors } from './src/theme';
import { dayFromOffset } from './src/dates';
import {
  useAlmanacStore,
  pastUnfinished,
  dayListIdForOffset,
  tasksForList,
  personOf,
  personName,
} from './src/store';
import { formatDuration } from './src/durations';
import useCalendarEvents from './src/useCalendarEvents';
import { scheduleDailyReminder } from './src/notifications';
import { useGoogleAuth } from './src/google/auth';
import useGoogleSync from './src/google/useGoogleSync';

import TabBar from './src/components/TabBar';
import TodayScreen from './src/screens/TodayScreen';
import ListsScreen from './src/screens/ListsScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import MoveTaskModal from './src/components/MoveTaskModal';
import ListOptionsModal from './src/components/ListOptionsModal';
import NameModal from './src/components/NameModal';

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
  const calendar = useCalendarEvents(dayOffset);
  const store = useAlmanacStore();
  const google = useGoogleAuth();
  const sync = useGoogleSync(store, google);

  const [reminderStatus, setReminderStatus] = useState('pending');
  const [reviewDismissed, setReviewDismissed] = useState(false);
  const [movingTaskId, setMovingTaskId] = useState(null);
  const [optionsListId, setOptionsListId] = useState(null);
  const [renamingListId, setRenamingListId] = useState(null);
  const [addingList, setAddingList] = useState(false);
  const [addingPerson, setAddingPerson] = useState(false);

  useEffect(() => {
    scheduleDailyReminder()
      .then(setReminderStatus)
      .catch((err) => {
        console.warn('Reminder setup failed', err);
        setReminderStatus('error');
      });
  }, []);

  const onRefresh = async () => {
    await Promise.all([calendar.refresh(), sync.syncNow()]);
  };

  const dayListId = dayListIdForOffset(dayOffset);
  const headerDate = dayFromOffset(dayOffset);

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
  const filterName = personFilter === 'all' ? null : personName(store.people, personFilter);

  const addTask = (text, listId) => {
    const list = store.lists.find((l) => l.id === listId);
    const personId = personFilter !== 'all' ? personFilter : list?.personId || null;
    store.addTask(text, listId, personId);
  };
  const addList = (name) => store.addList(name, personFilter !== 'all' ? personFilter : null);

  // ----- review + summary --------------------------------------------------
  const reviewTasks = useMemo(() => pastUnfinished(visibleTasks), [visibleTasks]);
  const showReview = dayOffset === 0 && store.loaded && !reviewDismissed && reviewTasks.length > 0;

  const daySummary = useMemo(() => {
    const { done } = tasksForList(visibleTasks, dayListId);
    if (done.length === 0) return null;
    const tracked = done.reduce((sum, t) => sum + (t.durationMs || 0), 0);
    const parts = [`${done.length} done`];
    if (tracked > 0) parts.push(`${formatDuration(tracked)} tracked`);
    return parts.join(' · ');
  }, [visibleTasks, dayListId]);

  const listProps = {
    tasks: visibleTasks,
    tagFor,
    onAdd: addTask,
    onToggle: store.toggleTask,
    onStart: store.startTask,
    onFinish: store.finishTask,
    onDelete: store.deleteTask,
    onMove: (task) => setMovingTaskId(task.id),
    onClearCompleted: store.clearCompleted,
  };

  const personProps = {
    people: store.people,
    personFilter,
    setPersonFilter,
    onAddPerson: () => setAddingPerson(true),
    filterName,
  };

  const movingTask = movingTaskId ? store.tasks.find((t) => t.id === movingTaskId) || null : null;
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
            showReview={showReview}
            reviewTasks={reviewTasks}
            onApplyReview={(carry, drop) => store.applyReview(carry, drop)}
            onLaterReview={() => setReviewDismissed(true)}
            calendar={calendar}
            onRefresh={onRefresh}
            dayListId={dayListId}
            daySummary={daySummary}
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
            onRefresh={onRefresh}
            refreshing={sync.state === 'syncing'}
            listProps={listProps}
          />
        )}
        {tab === 'settings' && (
          <SettingsScreen
            google={google}
            sync={sync}
            reminderStatus={reminderStatus}
            people={store.people}
            onAddPerson={() => setAddingPerson(true)}
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

      <MoveTaskModal
        task={movingTask}
        lists={store.lists}
        people={store.people}
        onSetPerson={store.setTaskPerson}
        onMove={(id, listId) => {
          store.moveTask(id, listId);
          setMovingTaskId(null);
        }}
        onClose={() => setMovingTaskId(null)}
      />

      <StatusBar style="dark" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  body: { flex: 1 },
});
