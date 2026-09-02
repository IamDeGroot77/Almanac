import { StatusBar } from 'expo-status-bar';
import {
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useEffect, useMemo, useState } from 'react';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { colors, shared } from './src/theme';
import { dayFromOffset, formatHeaderDate } from './src/dates';
import { useAlmanacStore, pastUnfinished, dayListIdForOffset } from './src/store';
import useCalendarEvents from './src/useCalendarEvents';
import { scheduleDailyReminder, reminderMessage } from './src/notifications';
import EventsSection from './src/components/EventsSection';
import TaskList from './src/components/TaskList';
import ReviewCard from './src/components/ReviewCard';
import MoveTaskModal from './src/components/MoveTaskModal';
import { SmallButton } from './src/components/Buttons';

export default function App() {
  return (
    <SafeAreaProvider>
      <AlmanacScreen />
    </SafeAreaProvider>
  );
}

function AlmanacScreen() {
  const [dayOffset, setDayOffset] = useState(0); // 0 = today, 1 = tomorrow
  const calendar = useCalendarEvents(dayOffset);
  const store = useAlmanacStore();

  const [reminderStatus, setReminderStatus] = useState('pending');
  const [reviewDismissed, setReviewDismissed] = useState(false);
  const [movingTask, setMovingTask] = useState(null);
  const [renamingListId, setRenamingListId] = useState(null);
  const [newListName, setNewListName] = useState('');
  const [addingList, setAddingList] = useState(false);

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
  const reviewTasks = useMemo(() => pastUnfinished(store.tasks), [store.tasks]);
  const showReview = dayOffset === 0 && store.loaded && !reviewDismissed && reviewTasks.length > 0;

  const onListTitleLongPress = (listId) => {
    const list = store.lists.find((l) => l.id === listId);
    if (!list) return;
    Alert.alert(list.name, undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Rename', onPress: () => setRenamingListId(listId) },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () =>
          Alert.alert(
            `Delete "${list.name}"?`,
            'Its tasks will be deleted too.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Delete', style: 'destructive', onPress: () => store.deleteList(listId) },
            ]
          ),
      },
    ]);
  };

  const submitNewList = () => {
    store.addList(newListName);
    setNewListName('');
    setAddingList(false);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={calendar.refreshing} onRefresh={calendar.refresh} />
        }
      >
        <Text style={styles.kicker}>{dayOffset === 0 ? 'Today' : 'Tomorrow'}</Text>
        <Text style={styles.title}>{formatHeaderDate(headerDate)}</Text>

        <View style={styles.segment}>
          <SegmentButton label="Today" active={dayOffset === 0} onPress={() => setDayOffset(0)} />
          <SegmentButton label="Tomorrow" active={dayOffset === 1} onPress={() => setDayOffset(1)} />
        </View>

        {showReview && (
          <ReviewCard
            tasks={reviewTasks}
            onApply={(carry, drop) => store.applyReview(carry, drop)}
            onLater={() => setReviewDismissed(true)}
          />
        )}

        <EventsSection status={calendar.status} events={calendar.events} onRetry={calendar.retry} />

        <TaskList
          listId={dayListId}
          title={dayOffset === 0 ? "Today's list" : "Tomorrow's list"}
          tasks={store.tasks}
          emptyText={dayOffset === 0 ? 'Nothing planned yet.' : 'Nothing lined up for tomorrow.'}
          onAdd={store.addTask}
          onToggle={store.toggleTask}
          onDelete={store.deleteTask}
          onMove={setMovingTask}
          onClearCompleted={store.clearCompleted}
        />

        {store.lists.map((list) => (
          <TaskList
            key={list.id}
            listId={list.id}
            title={list.name}
            tasks={store.tasks}
            emptyText="Empty."
            onAdd={store.addTask}
            onToggle={store.toggleTask}
            onDelete={store.deleteTask}
            onMove={setMovingTask}
            onClearCompleted={store.clearCompleted}
            onTitleLongPress={onListTitleLongPress}
            renaming={renamingListId === list.id}
            onRename={(id, name) => {
              store.renameList(id, name);
              setRenamingListId(null);
            }}
            onCancelRename={() => setRenamingListId(null)}
          />
        ))}

        <View style={styles.newList}>
          {addingList ? (
            <View style={styles.inputRow}>
              <TextInput
                style={shared.input}
                value={newListName}
                onChangeText={setNewListName}
                placeholder="List name"
                placeholderTextColor={colors.muted}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={submitNewList}
              />
              <TouchableOpacity style={shared.primaryButton} onPress={submitNewList} accessibilityRole="button">
                <Text style={shared.primaryButtonText}>Create</Text>
              </TouchableOpacity>
              <SmallButton label="Cancel" onPress={() => { setAddingList(false); setNewListName(''); }} style={styles.cancelButton} />
            </View>
          ) : (
            <SmallButton label="+ New list" onPress={() => setAddingList(true)} />
          )}
          {store.lists.length === 0 && !addingList && (
            <Text style={styles.hint}>
              Lists hold tasks that aren't tied to a day, like Groceries or Home.
            </Text>
          )}
        </View>

        <Text style={styles.footer}>{reminderMessage(reminderStatus)}</Text>
      </ScrollView>

      <MoveTaskModal
        task={movingTask}
        lists={store.lists}
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

  newList: { marginTop: 28 },
  inputRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  cancelButton: { alignSelf: 'center' },
  hint: { marginTop: 8, fontSize: 13, color: colors.muted },

  footer: { marginTop: 32, fontSize: 13, color: colors.muted, textAlign: 'center' },
});
