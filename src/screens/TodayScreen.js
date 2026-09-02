import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors } from '../theme';
import { formatHeaderDate } from '../dates';
import Screen from '../components/Screen';
import PersonChips from '../components/PersonChips';
import ReviewCard from '../components/ReviewCard';
import EventsSection from '../components/EventsSection';
import TaskList from '../components/TaskList';

export default function TodayScreen({
  dayOffset,
  setDayOffset,
  headerDate,
  people,
  personFilter,
  setPersonFilter,
  onAddPerson,
  filterName,
  showReview,
  reviewTasks,
  onApplyReview,
  onLaterReview,
  calendar,
  onRefresh,
  dayListId,
  daySummary,
  listProps,
}) {
  return (
    <Screen refreshing={calendar.refreshing} onRefresh={onRefresh}>
      <Text style={styles.kicker}>{dayOffset === 0 ? 'Today' : 'Tomorrow'}</Text>
      <Text style={styles.title}>{formatHeaderDate(headerDate)}</Text>

      <View style={styles.segment}>
        <SegmentButton label="Today" active={dayOffset === 0} onPress={() => setDayOffset(0)} />
        <SegmentButton label="Tomorrow" active={dayOffset === 1} onPress={() => setDayOffset(1)} />
      </View>

      <View style={styles.people}>
        <PersonChips
          people={people}
          selected={personFilter}
          onSelect={setPersonFilter}
          allowAll
          onAdd={onAddPerson}
        />
      </View>

      {showReview && (
        <ReviewCard
          tasks={reviewTasks}
          tagFor={listProps.tagFor}
          onApply={onApplyReview}
          onLater={onLaterReview}
        />
      )}

      <EventsSection
        status={calendar.status}
        events={calendar.events}
        calendarNames={calendar.calendarNames}
        onRetry={calendar.retry}
      />

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
    </Screen>
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
});
