import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors } from '../theme';
import { formatHeaderDate } from '../dates';
import Screen from '../components/Screen';
import PersonChips from '../components/PersonChips';
import ReviewCard from '../components/ReviewCard';
import EventsSection from '../components/EventsSection';
import TaskList from '../components/TaskList';
import DueSection from '../components/DueSection';
import RoutineCard from '../components/RoutineCard';
import WrapUpCard from '../components/WrapUpCard';
import DayBracket from '../components/DayBracket';

export default function TodayScreen({
  dayOffset,
  setDayOffset,
  headerDate,
  people,
  personFilter,
  setPersonFilter,
  onAddPerson,
  filterName,
  openDay,
  pastMidnight,
  lastClosed,
  dayLabel,
  onStartDay,
  onGoingToBed,
  onReopenDay,
  onStartFresh,
  energy,
  onEnergy,
  showReview,
  reviewTasks,
  onApplyReview,
  onLaterReview,
  calendar,
  onRefresh,
  dueOverdue,
  dueToday,
  contextFor,
  routines,
  routineState,
  lists,
  onToggleRoutineItem,
  onEditRoutine,
  dayListId,
  daySummary,
  wrapUp, // null | props for WrapUpCard
  onJustOneThing,
  listProps,
}) {
  const isToday = dayOffset === 0;
  return (
    <Screen refreshing={calendar.refreshing} onRefresh={onRefresh}>
      <Text style={styles.kicker}>
        {isToday ? (pastMidnight ? 'Today · past midnight' : 'Today') : 'Tomorrow'}
      </Text>
      <Text style={styles.title}>{formatHeaderDate(headerDate)}</Text>

      <View style={styles.segment}>
        <SegmentButton label="Today" active={isToday} onPress={() => setDayOffset(0)} />
        <SegmentButton label="Tomorrow" active={!isToday} onPress={() => setDayOffset(1)} />
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

      {isToday && (
        <DayBracket
          openDay={openDay}
          pastMidnight={pastMidnight}
          lastClosed={lastClosed}
          dayLabel={dayLabel}
          leftovers={reviewTasks.length}
          onStart={onStartDay}
          onBed={onGoingToBed}
          onReopen={onReopenDay}
          onStartFresh={onStartFresh}
          energy={energy}
          onEnergy={onEnergy}
        />
      )}

      {showReview && (
        <ReviewCard tasks={reviewTasks} tagFor={listProps.tagFor} onApply={onApplyReview} onLater={onLaterReview} />
      )}

      {wrapUp && <WrapUpCard {...wrapUp} />}

      <EventsSection
        status={calendar.status}
        events={calendar.events}
        calendarNames={calendar.calendarNames}
        onRetry={calendar.retry}
      />

      {isToday && (
        <DueSection overdue={dueOverdue} dueToday={dueToday} contextFor={contextFor} listProps={listProps} />
      )}

      {isToday && routines.length > 0 && (
        <View style={styles.routines}>
          <Text style={styles.sectionTitle}>Routines</Text>
          {routines.map((r) => (
            <RoutineCard
              key={r.id}
              routine={r}
              state={routineState}
              lists={lists}
              onToggleItem={onToggleRoutineItem}
              onEdit={onEditRoutine}
            />
          ))}
        </View>
      )}

      {isToday && onJustOneThing && (
        <TouchableOpacity style={styles.oneThing} onPress={onJustOneThing} accessibilityRole="button">
          <Text style={styles.oneThingText}>Just one thing</Text>
          <Text style={styles.oneThingHint}>Pick the next task worth starting and open it full screen.</Text>
        </TouchableOpacity>
      )}

      <TaskList
        listId={dayListId}
        title={(isToday ? "Today's tasks" : "Tomorrow's tasks") + (filterName ? ` for ${filterName}` : '')}
        subtitle={daySummary}
        emptyText={isToday ? 'Nothing planned yet.' : 'Nothing lined up for tomorrow.'}
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
  kicker: { fontSize: 13, fontWeight: '600', letterSpacing: 1, textTransform: 'uppercase', color: colors.accent },
  title: { fontSize: 26, fontWeight: '700', color: colors.ink, marginTop: 4 },
  segment: { flexDirection: 'row', marginTop: 16, backgroundColor: colors.accentSoft, borderRadius: 10, padding: 3 },
  segmentButton: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  segmentButtonActive: { backgroundColor: colors.bg },
  segmentText: { fontSize: 14, fontWeight: '600', color: colors.accent },
  segmentTextActive: { color: colors.ink },
  people: { marginTop: 12 },
  routines: { marginTop: 28 },
  oneThing: {
    marginTop: 24,
    padding: 14,
    borderRadius: 12,
    backgroundColor: colors.accent,
  },
  oneThingText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  oneThingHint: { color: colors.accentSoft, fontSize: 12, marginTop: 2 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: colors.ink },
});
