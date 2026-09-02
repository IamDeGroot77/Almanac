import { StatusBar } from 'expo-status-bar';
import {
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useEffect, useMemo, useState } from 'react';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { colors } from './src/theme';
import { dayFromOffset, formatHeaderDate } from './src/dates';
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
import { scheduleDailyReminder, reminderMessage } from './src/notifications';
import EventsSection from './src/components/EventsSection';
import TaskList from './src/components/TaskList';
import ReviewCard from './src/components/ReviewCard';
import MoveTaskModal from './src/components/MoveTaskModal';
import ListOptionsModal from './src/components/ListOptionsModal';
import NameModal from './src/components/NameModal';
import PersonChips from './src/components/PersonChips';
import GoogleSection from './src/components/GoogleSection';
import DevSection from './src/components/DevSection';
import { SmallButton } from './src/components/Buttons';
import { useGoogleAuth } from './src/google/auth';
import useGoogleSync from './src/google/useGoogleSync';

export default function App() {
  return (
    <SafeAreaProvider>
      <AlmanacScreen />
    </SafeAreaProvider>
  );
}

function AlmanacScreen() {
  const [dayOffset, setDayOffset] = useState(0); // 0 = today, 1 = tomorrow
  const [personFilter, setPersonFilter] = useState('all'); // 'all' | person id
  const calendar = useCalendarEvents(dayOffset);
  const store = useAlmanacStore();
  const google = useGoogleAuth();
  const sync = useGoogleSync(store, google);

  const onRefresh = async () => {
    await Promise.all([calendar.refresh(), sync.syncNow()]);
  };

  const [reminderStatus, setReminderStatus] = useState('pending');
  const [reviewDismissed, setReviewDismissed] = useState(false);
  const [movingTask, setMovingTask] = useState(null);
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

  const dayListId = dayListIdForOffset(dayOffset);
  const headerDate = dayFromOffset(dayOffset);

  // ----- people -----------------------------------------------------------
  const matchesFilter = (t) => personFilter === 'all' || personOf(t) === personFilter;
  const visibleTasks = useMemo(
    () => store.tasks.filter(matchesFilter),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [store.tasks, personFilter]
  );
  // Show a person tag only when looking at everyone, and only for people other than me.
  const tagFor = (t) =>
    personFilter === 'all' && personOf(t) !== 'me' ? personName(store.people, t.personId) : null;

  const visibleLists = store.lists.filter(
    (l) =>
      personFilter === 'all' ||
      personOf(l) === personFilter ||
      store.tasks.some((t) => t.listId === l.id && matchesFilter(t))
  );

  // New tasks are tagged for the filtered person, else the list's person.
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

  const optionsList = store.lists.find((l) => l.id === optionsListId) || null;
  const filterName = personFilter === 'all' ? null : personName(store.people, personFilter);

  const listProps = {
    tasks: visibleTasks,
    tagFor,
    onAdd: addTask,
    onToggle: store.toggleTask,
    onStart: store.startTask,
    onFinish: store.finishTask,
    onDelete: store.deleteTask,
    onMove: setMovingTask,
    onClearCompleted: store.clearCompleted,
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView style={styles.safe} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={calendar.refreshing} onRefresh={onRefresh} />}
        >
          <Text style={styles.kicker}>{dayOffset === 0 ? 'Today' : 'Tomorrow'}</Text>
          <Text style={styles.title}>{formatHeaderDate(headerDate)}</Text>

          <View style={styles.segment}>
            <SegmentButton label="Today" active={dayOffset === 0} onPress={() => setDayOffset(0)} />
            <SegmentButton label="Tomorrow" active={dayOffset === 1} onPress={() => setDayOffset(1)} />
          </View>

          <View style={styles.people}>
            <PersonChips
              people={store.people}
              selected={personFilter}
              onSelect={setPersonFilter}
              allowAll
              onAdd={() => setAddingPerson(true)}
            />
          </View>

          {showReview && (
            <ReviewCard
              tasks={reviewTasks}
              tagFor={tagFor}
              onApply={(carry, drop) => store.applyReview(carry, drop)}
              onLater={() => setReviewDismissed(true)}
            />
          )}

          <EventsSection status={calendar.status} events={calendar.events} onRetry={calendar.retry} />

          <TaskList
            listId={dayListId}
            title={
              (dayOffset === 0 ? "Today's tasks" : "Tomorrow's tasks") +
              (filterName ? ` for ${filterName}` : '')
            }
            subtitle={daySummary}
            emptyText={dayOffset === 0 ? 'Nothing planned yet.' : 'Nothing lined up for tomorrow.'}
            {...listProps}
          />

          <View style={styles.listsHeader}>
            <Text style={styles.listsTitle}>Lists{filterName ? ` · ${filterName}` : ''}</Text>
            <SmallButton label="+ New list" onPress={() => setAddingList(true)} />
          </View>
          {visibleLists.length === 0 && (
            <Text style={styles.hint}>
              {store.lists.length === 0
                ? "Named lists hold things that aren't tied to a day, like Groceries or Home."
                : `No lists for ${filterName} yet.`}
            </Text>
          )}

          {visibleLists.map((list) => (
            <TaskList
              key={list.id}
              listId={list.id}
              title={list.name}
              subtitle={[
                personFilter === 'all' && personOf(list) !== 'me'
                  ? `For ${personName(store.people, list.personId)}`
                  : null,
                list.googleListId && google.account ? 'Synced with Google Tasks' : null,
              ]
                .filter(Boolean)
                .join(' · ') || null}
              emptyText="Empty."
              onTitleLongPress={setOptionsListId}
              renaming={renamingListId === list.id}
              onRename={(id, name) => {
                store.renameList(id, name);
                setRenamingListId(null);
              }}
              onCancelRename={() => setRenamingListId(null)}
              {...listProps}
            />
          ))}

          <GoogleSection auth={google} sync={sync} />

          {__DEV__ && (
            <DevSection
              onStageReview={() => {
                store.devBackdateOpenTasks();
                setReviewDismissed(false);
                setDayOffset(0);
              }}
            />
          )}

          <Text style={styles.footer}>{reminderMessage(reminderStatus)}</Text>
        </ScrollView>
      </KeyboardAvoidingView>

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
        task={movingTask ? store.tasks.find((t) => t.id === movingTask.id) || null : null}
        lists={store.lists}
        people={store.people}
        onSetPerson={store.setTaskPerson}
        onMove={(id, listId) => {
          store.moveTask(id, listId);
          setMovingTask(null);
        }}
        onClose={() => setMovingTask(null)}
      />

      <StatusBar style="dark" />
    </SafeAreaView>
  );
}

function SegmentButton({ label, active, onPress }) {
  return (
    <TouchableOpacity
      style={[styles.segmentButton, active && styles.segmentButtonActive]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
    >
      <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  container: { padding: 20, paddingBottom: 40 },

  kicker: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.accent,
  },
  title: { fontSize: 26, fontWeight: '700', color: colors.ink, marginTop: 4 },

  segment: {
    flexDirection: 'row',
    marginTop: 16,
    backgroundColor: colors.accentSoft,
    borderRadius: 10,
    padding: 3,
  },
  segmentButton: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  segmentButtonActive: { backgroundColor: colors.bg },
  segmentText: { fontSize: 14, fontWeight: '600', color: colors.accent },
  segmentTextActive: { color: colors.ink },

  people: { marginTop: 12 },

  listsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 36,
    paddingTop: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
  },
  listsTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.muted,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  hint: { marginTop: 8, fontSize: 13, color: colors.muted },

  footer: { marginTop: 32, fontSize: 13, color: colors.muted, textAlign: 'center' },
});
