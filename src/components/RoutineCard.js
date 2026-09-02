import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, shared } from '../theme';
import { activeItems, itemProgress, periodKey, periodLabel, daysLeftInPeriod, routineProgress } from '../routines';

// One routine for the current period: plain items you tick, quota items that
// count themselves from finished tasks.
export default function RoutineCard({ routine, state, lists, routines = [], onToggleItem, onEdit }) {
  const now = new Date();
  const key = periodKey(routine, now);
  const items = activeItems(routine, now);
  const progress = routineProgress(routine, state, now);
  const sourceName = (item) =>
    item.routineId ? routines.find((r) => r.id === item.routineId)?.name || 'a deleted routine' : lists.find((l) => l.id === item.listId)?.name || 'a deleted list';
  const pct = progress.target ? progress.done / progress.target : 0;

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
          {progress.done}/{progress.target}
        </Text>
      </TouchableOpacity>

      <View style={styles.track}>
        <View style={[styles.fill, { width: `${Math.round(pct * 100)}%` }]} />
      </View>

      {items.length === 0 && <Text style={shared.muted}>Nothing scheduled for today.</Text>}

      {items.map((item) => {
        const p = itemProgress(routine, item, state, now);
        if (item.type === 'task') {
          return (
            <TouchableOpacity
              key={item.id}
              style={styles.row}
              onPress={() => onToggleItem(routine.id, key, item.id)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: p.complete }}
            >
              <View style={[styles.box, p.complete && styles.boxDone]}>
                {p.complete ? <Text style={styles.check}>✓</Text> : null}
              </View>
              <Text style={[styles.text, p.complete && styles.textDone]}>{item.text}</Text>
            </TouchableOpacity>
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
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.bg,
  },
  cardComplete: { borderColor: colors.accentSoft, backgroundColor: colors.accentSoft },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerText: { flex: 1 },
  name: { fontSize: 16, fontWeight: '700', color: colors.ink },
  period: { fontSize: 12, color: colors.muted, marginTop: 1 },
  count: { fontSize: 15, fontWeight: '700', color: colors.muted, marginLeft: 12 },
  countComplete: { color: colors.accent },
  track: { height: 4, borderRadius: 2, backgroundColor: colors.line, marginTop: 10, marginBottom: 4 },
  fill: { height: 4, borderRadius: 2, backgroundColor: colors.accent },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
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
