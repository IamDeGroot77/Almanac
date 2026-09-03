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
import ConsiderSection from '../components/ConsiderSection';
import BlockCard from '../components/BlockCard';
import ScratchCard from '../components/ScratchCard';
import DopamenuCard from '../components/DopamenuCard';
import WrapUpCard from '../components/WrapUpCard';
import DayBracket from '../components/DayBracket';
import WeekStrip from '../components/WeekStrip';
import WeatherLine from '../components/WeatherLine';
import Timeline from '../components/Timeline';
import { almanacDayKeyFromOffset } from '../clock';

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
  forecast,
  nowMode,
  setNowMode,
  allTasks,
  considerations,
  onConsiderToday,
  onConsiderLater,
  allRoutines,
  blockInfo,
  routineActive,
  timerAppName,
  onStartRoutineItem,
  onFinishRoutineItem,
  onCancelRoutineItem,
  scratch,
  scratchActions,
  capacity,
  onSkipRoutineItem,
  dopamenu,
  onDopamenuDid,
  restDay = false,
  onToggleRestDay,
}) {
  const isToday = dayOffset === 0;
  const dayKey = almanacDayKeyFromOffset(dayOffset);
  const dayName = headerDate.toLocaleDateString([], { weekday: 'long' });
  const kicker = isToday ? (pastMidnight ? 'Today · past midnight' : 'Today') : dayOffset === 1 ? 'Tomorrow' : dayName;
  const listTitle =
    (isToday ? "Today's tasks" : dayOffset === 1 ? "Tomorrow's tasks" : dayName + "'s tasks") +
    (filterName ? ' for ' + filterName : '');
  // Now mode: only what can be acted on this minute.
  const nowListProps = nowMode ? { ...listProps, tasks: listProps.tasks.filter((t) => !t.done) } : listProps;
  return (
    <Screen refreshing={calendar.refreshing} onRefresh={onRefresh}>
      <View style={styles.headerRow}>
        <View style={styles.headerText}>
          <Text style={styles.kicker}>{kicker}</Text>
          <Text style={styles.title}>{formatHeaderDate(headerDate)}</Text>
          <WeatherLine forecast={forecast} dayKey={dayKey} isToday={isToday} />
        </View>
        {isToday && onToggleRestDay ? (
          <TouchableOpacity style={[styles.nowToggle, restDay && styles.nowToggleOn]} onPress={onToggleRestDay} accessibilityRole="button" accessibilityState={{ selected: restDay }} accessibilityLabel="Rest day: nothing counts, nothing nags">
            <Text style={[styles.nowToggleText, restDay && styles.nowToggleTextOn]}>Rest</Text>
          </TouchableOpacity>
        ) : null}
        {isToday && setNowMode ? (
          <TouchableOpacity
            style={[styles.nowToggle, nowMode && styles.nowToggleOn]}
            onPress={() => setNowMode(!nowMode)}
            accessibilityRole="button"
            accessibilityState={{ selected: !!nowMode }}
            accessibilityLabel="Now mode: show only what matters right now"
          >
            <Text style={[styles.nowToggleText, nowMode && styles.nowToggleTextOn]}>Now</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {!nowMode && (
        <WeekStrip tasks={allTasks || listProps.tasks} selectedOffset={dayOffset} onSelect={setDayOffset} forecast={forecast} />
      )}

      <View style={styles.people}>
        <PersonChips
          people={people}
          selected={personFilter}
          onSelect={setPersonFilter}
          allowAll
          onAdd={onAddPerson}
        />
      </View>

      {isToday && scratchActions ? <ScratchCard scratch={scratch} {...scratchActions} /> : null}

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

      {!nowMode && (
        <EventsSection
          status={calendar.status}
          events={calendar.events}
          calendarNames={calendar.calendarNames}
          onRetry={calendar.retry}
        />
      )}

      {calendar.status === 'granted' && (
        <Timeline
          dayKey={dayKey}
          events={calendar.events}
          dueTasks={isToday ? dueToday : []}
          wokeAt={openDay?.wokeAt}
          sleptAt={openDay?.sleptAt}
          isToday={isToday}
          blocks={blockInfo?.dayBlocks || []}
          blockColor={blockInfo?.colorFor}
        />
      )}

      {isToday && (energy?.wake === 1 || energy?.midday === 1) ? <DopamenuCard menu={dopamenu} onDid={onDopamenuDid} /> : null}

      {isToday && blockInfo && !restDay ? (
        <BlockCard
          block={blockInfo.current}
          next={blockInfo.next}
          category={blockInfo.category}
          nextCategory={blockInfo.nextCategory}
          color={blockInfo.color}
          picks={blockInfo.picks}
          contextFor={contextFor}
          onStart={listProps.onStart}
          onOpen={listProps.onMove}
          onJustOneThing={onJustOneThing}
        />
      ) : null}

      {isToday && (
        <DueSection overdue={dueOverdue} dueToday={dueToday} contextFor={contextFor} listProps={listProps} />
      )}

      {isToday && !nowMode && !restDay && <ConsiderSection items={considerations} onToday={onConsiderToday} onLater={onConsiderLater} />}

      <TaskList
        listId={dayListId}
        title={listTitle}
        subtitle={nowMode ? 'Now mode · open tasks only' : daySummary}
        subtitleWarn={!nowMode && !!capacity?.over}
        emptyText={isToday ? 'Nothing planned yet.' : dayOffset === 1 ? 'Nothing lined up for tomorrow.' : 'Nothing on ' + dayName + ' yet.'}
        emptyHint={isToday ? 'Add one small thing, or use Just one thing on Home to pick from your lists.' : 'Add something here and it waits for that day.'}
        {...nowListProps}
      />

      {isToday && !nowMode && !restDay && routines.length > 0 && (
        <View style={styles.routines}>
          <Text style={styles.sectionTitle}>Routines</Text>
          {routines.map((r) => (
            <RoutineCard
              key={r.id}
              routine={r}
              state={routineState}
              lists={lists}
              routines={allRoutines}
              active={routineActive}
              timerAppName={timerAppName}
              onStartItem={onStartRoutineItem}
              onFinishItem={onFinishRoutineItem}
              onCancelItem={onCancelRoutineItem}
              onToggleItem={onToggleRoutineItem}
              onSkipItem={onSkipRoutineItem}
              onEdit={onEditRoutine}
            />
          ))}
        </View>
      )}

      {isToday && onJustOneThing && !blockInfo?.current && (
        <TouchableOpacity style={styles.oneThing} onPress={onJustOneThing} accessibilityRole="button">
          <Text style={styles.oneThingText}>Just one thing</Text>
          <Text style={styles.oneThingHint}>Pick the next task worth starting and open it full screen.</Text>
        </TouchableOpacity>
      )}

    </Screen>
  );
}

const styles = StyleSheet.create({
  kicker: { fontSize: 13, fontWeight: '600', letterSpacing: 1, textTransform: 'uppercase', color: colors.accent },
  title: { fontSize: 26, fontWeight: '700', color: colors.ink, marginTop: 4 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 6 },
  headerText: { flex: 1, marginRight: 10 },
  nowToggle: { borderWidth: 1, borderColor: colors.line, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, marginTop: 4 },
  nowToggleOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  nowToggleText: { fontSize: 13, fontWeight: '700', color: colors.muted },
  nowToggleTextOn: { color: colors.bg },
  people: { marginTop: 12 },
  routines: { marginTop: 28 },
  oneThing: {
    marginTop: 24,
    padding: 14,
    borderRadius: 14,
    backgroundColor: colors.accent,
  },
  oneThingText: { color: colors.onAccent, fontSize: 16, fontWeight: '700' },
  oneThingHint: { color: colors.accentSoft, fontSize: 12, marginTop: 2 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: colors.ink, letterSpacing: -0.2 },
});
