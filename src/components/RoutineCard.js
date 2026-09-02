import { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, shared } from '../theme';
import { activeItems, itemProgress, periodKey, periodLabel, daysLeftInPeriod, routineProgress, minutesToday, needsWarmup } from '../routines';
import { SmallButton } from './Buttons';
import { useNow } from '../durations';

// One routine for the current period: plain items you tick or time, quota
// items that count themselves, and a minutes-a-day bar when the routine has
// a points goal (a minute is a point).
export default function RoutineCard({ routine, state, lists, routines = [], active, timerAppName, onToggleItem, onStartItem, onFinishItem, onCancelItem, onEdit }) {
  const now = new Date();
  const tick = useNow(!!active && active.routineId === routine.id, 15000);
  const key = periodKey(routine, now);
  const items = activeItems(routine, now);
  const progress = routineProgress(routine, state, now);
  const sourceName = (item) =>
    item.routineId ? routines.find((r) => r.id === item.routineId)?.name || 'a deleted routine' : lists.find((l) => l.id === item.listId)?.name || 'a deleted list';
  const pct = progress.target ? progress.done / progress.target : 0;
  const minutes = routine.minutesPerDay ? minutesToday(routine.id, state.routineLog, now) : null;
  const minutesPct = routine.minutesPerDay ? Math.min(1, (minutes || 0) / routine.minutesPerDay) : 0;
  const mine = active && active.routineId === routine.id ? active : null;
  const [warmupFor, setWarmupFor] = useState(null); // item awaiting the stretch decision

  const start = (item) => {
    if (routine.warmup && needsWarmup(routine.id, state.routineLog, Date.now())) {
      setWarmupFor(item);
      return;
    }
    onStartItem(routine.id, item.id, item.text);
  };

  if (progress.complete && !mine && !warmupFor) {
    return (
      <TouchableOpacity style={[styles.card, styles.cardComplete, styles.compact]} onLongPress={() => onEdit(routine)} delayLongPress={350} accessibilityRole="button" accessibilityHint="Long press to edit this routine">
        <Text style={styles.compactText}>✓ {routine.name}</Text>
        <Text style={styles.compactMeta}>{routine.minutesPerDay ? `${minutes} min today` : `${progress.done}/${progress.target}`}</Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={[styles.card, progress.complete && styles.cardComplete]}>
      <TouchableOpacity
        style={styles.header}
        onLongPress={() => onEdit(routine)}
        delayLongPress={350}
        accessibilityRole="button"
        accessibilityHint="Long press to edit this routine"
      >
        <View style={styles.headerText}>
          <Text style={styles.name}>{routine.name}</Text>
          <Text style={styles.period}>
            {periodLabel(routine, now)}
            {routine.cadence === 'weekly' ? ` · ${daysLeftInPeriod(routine, now)} days left` : ''}
          </Text>
        </View>
        <Text style={[styles.count, progress.complete && styles.countComplete]}>
          {routine.minutesPerDay ? `${minutes} / ${routine.minutesPerDay} min` : `${progress.done}/${progress.target}`}
        </Text>
      </TouchableOpacity>

      <View style={styles.track}>
        <View style={[styles.fill, { width: `${Math.round((routine.minutesPerDay ? minutesPct : pct) * 100)}%` }]} />
      </View>
      {routine.minutesPerDay ? (
        <Text style={styles.points}>
          {minutes >= routine.minutesPerDay ? `${routine.minutesPerDay} points today, done.` : `${routine.minutesPerDay - minutes} more minutes today. A minute is a point.`}
        </Text>
      ) : null}

      {mine ? (
        <View style={styles.running}>
          <View style={styles.body}>
            <Text style={styles.runningText}>{mine.text} · running {Math.max(1, Math.round((tick - mine.startedAt) / 60000))} min</Text>
            <Text style={styles.meta}>{timerAppName ? `${timerAppName} is open. Coming back here logs the time.` : 'Tap Done when you stop.'}</Text>
          </View>
          <SmallButton label="Done" onPress={() => onFinishItem()} />
          <SmallButton label="Cancel" onPress={() => onCancelItem()} />
        </View>
      ) : null}

      {warmupFor ? (
        <View style={styles.warmup}>
          <Text style={styles.warmupText}>Stretch first? It's been a while. Five minutes counts toward today.</Text>
          <View style={styles.row}>
            <SmallButton
              label="Stretch"
              onPress={() => {
                setWarmupFor(null);
                onStartItem(routine.id, 'warmup', 'Stretch');
              }}
            />
            <SmallButton
              label={`Skip, start ${warmupFor.text}`}
              onPress={() => {
                const item = warmupFor;
                setWarmupFor(null);
                onStartItem(routine.id, item.id, item.text);
              }}
            />
          </View>
        </View>
      ) : null}

      {items.length === 0 && <Text style={shared.muted}>Nothing scheduled for today.</Text>}

      {items.map((item) => {
        const p = itemProgress(routine, item, state, now);
        if (item.type === 'task') {
          return (
            <View key={item.id} style={styles.row}>
              <TouchableOpacity
                style={styles.tick}
                onPress={() => onToggleItem(routine.id, key, item.id)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: p.complete }}
              >
                <View style={[styles.box, p.complete && styles.boxDone]}>{p.complete ? <Text style={styles.check}>✓</Text> : null}</View>
                <Text style={[styles.text, p.complete && styles.textDone]}>{item.text}</Text>
              </TouchableOpacity>
              {onStartItem && !mine && (routine.minutesPerDay || routine.warmup) ? <SmallButton label="Start" onPress={() => start(item)} /> : null}
            </View>
          );
        }
        if (item.type === 'minutes') {
          return (
            <View key={item.id} style={styles.row}>
              <View style={[styles.box, styles.boxQuota, p.complete && styles.boxDone]}>
                {p.complete ? <Text style={styles.check}>✓</Text> : <Text style={styles.quotaNum}>{p.minutes.done}</Text>}
              </View>
              <Text style={[styles.text, p.complete && styles.textDone]}>
                {p.minutes.done} of {item.minutes} min from {sourceName(item)}
              </Text>
            </View>
          );
        }
        return (
          <View key={item.id} style={styles.row}>
            <View style={[styles.box, styles.boxQuota, p.complete && styles.boxDone]}>
              {p.complete ? <Text style={styles.check}>✓</Text> : <Text style={styles.quotaNum}>{p.done}</Text>}
            </View>
            <Text style={[styles.text, p.complete && styles.textDone]}>
              {p.done} of {item.count} from {sourceName(item)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.bg,
  },
  cardComplete: { borderColor: colors.accentSoft, backgroundColor: colors.accentSoft },
  compact: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10 },
  compactText: { fontSize: 15, fontWeight: '600', color: colors.accent },
  compactMeta: { fontSize: 12, color: colors.muted },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerText: { flex: 1 },
  name: { fontSize: 16, fontWeight: '700', color: colors.ink },
  period: { fontSize: 12, color: colors.muted, marginTop: 1 },
  count: { fontSize: 15, fontWeight: '700', color: colors.muted, marginLeft: 12 },
  countComplete: { color: colors.accent },
  track: { height: 4, borderRadius: 2, backgroundColor: colors.line, marginTop: 10, marginBottom: 4 },
  fill: { height: 4, borderRadius: 2, backgroundColor: colors.accent },
  points: { fontSize: 12, color: colors.muted, marginBottom: 4 },
  running: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, marginTop: 8, borderRadius: 10, backgroundColor: colors.accentSoft },
  runningText: { fontSize: 14, fontWeight: '600', color: colors.ink },
  warmup: { padding: 10, marginTop: 8, borderRadius: 10, backgroundColor: colors.warnSoft },
  warmupText: { fontSize: 14, color: colors.ink },
  body: { flex: 1 },
  meta: { fontSize: 12, color: colors.muted, marginTop: 2 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 8 },
  tick: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  box: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  boxQuota: { borderRadius: 11 },
  boxDone: { backgroundColor: colors.accent },
  check: { color: colors.onAccent, fontSize: 13, fontWeight: '700' },
  quotaNum: { color: colors.accent, fontSize: 11, fontWeight: '700' },
  text: { fontSize: 15, color: colors.ink, flex: 1 },
  textDone: { color: colors.muted, textDecorationLine: 'line-through' },
});
