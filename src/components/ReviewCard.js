import { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { PrimaryButton, SmallButton } from './Buttons';
import { colors } from '../theme';
import { dayOfList } from '../store';
import { describeDayKey } from '../dates';

// Start-of-day review: every unfinished task from earlier days, each with a
// Carry / Drop choice. Nothing changes until Apply is pressed.
export default function ReviewCard({ tasks, onApply, onLater }) {
  // Set of task ids marked Drop. Everything else carries over.
  const [dropped, setDropped] = useState(() => new Set());

  const toggle = (id) =>
    setDropped((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const setAll = (drop) => setDropped(drop ? new Set(tasks.map((t) => t.id)) : new Set());

  const apply = () => {
    const carry = tasks.filter((t) => !dropped.has(t.id)).map((t) => t.id);
    const drop = tasks.filter((t) => dropped.has(t.id)).map((t) => t.id);
    onApply(carry, drop);
  };

  // Group by the day the task was on, oldest first (tasks arrive sorted).
  const groups = [];
  for (const t of tasks) {
    const key = dayOfList(t.listId);
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.tasks.push(t);
    else groups.push({ key, tasks: [t] });
  }

  const carryCount = tasks.length - dropped.size;

  return (
    <View style={styles.card}>
      <Text style={styles.kicker}>Start of day</Text>
      <Text style={styles.title}>
        {tasks.length === 1 ? '1 task was left unfinished.' : `${tasks.length} tasks were left unfinished.`}
      </Text>
      <Text style={styles.subtitle}>Choose what carries over to today.</Text>

      {groups.map((g) => (
        <View key={g.key} style={styles.group}>
          <Text style={styles.groupTitle}>{describeDayKey(g.key)}</Text>
          {g.tasks.map((t) => {
            const isDrop = dropped.has(t.id);
            return (
              <TouchableOpacity
                key={t.id}
                style={styles.row}
                onPress={() => toggle(t.id)}
                accessibilityRole="switch"
                accessibilityState={{ checked: !isDrop }}
                accessibilityLabel={`${t.text}. ${isDrop ? 'Will be dropped' : 'Will carry over'}`}
              >
                <Text style={[styles.text, isDrop && styles.textDrop]}>{t.text}</Text>
                <Text style={[styles.pill, isDrop ? styles.pillDrop : styles.pillCarry]}>
                  {isDrop ? 'Drop' : 'Carry'}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ))}

      <View style={styles.quick}>
        <SmallButton label="Carry all" onPress={() => setAll(false)} />
        <SmallButton label="Drop all" onPress={() => setAll(true)} />
      </View>

      <View style={styles.actions}>
        <PrimaryButton
          label={carryCount === 0 ? 'Drop all and start fresh' : `Carry ${carryCount} to today`}
          onPress={apply}
          style={styles.applyButton}
        />
        <TouchableOpacity onPress={onLater} style={styles.later} accessibilityRole="button">
          <Text style={styles.laterText}>Later</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 20,
    padding: 16,
    borderRadius: 12,
    backgroundColor: colors.warnSoft,
  },
  kicker: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.warn,
  },
  title: { fontSize: 17, fontWeight: '700', color: colors.ink, marginTop: 4 },
  subtitle: { fontSize: 14, color: colors.muted, marginTop: 2 },
  group: { marginTop: 14 },
  groupTitle: { fontSize: 13, fontWeight: '600', color: colors.muted, marginBottom: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  text: { flex: 1, fontSize: 16, color: colors.ink, marginRight: 12 },
  textDrop: { color: colors.muted, textDecorationLine: 'line-through' },
  pill: {
    fontSize: 13,
    fontWeight: '600',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: 'hidden',
  },
  pillCarry: { backgroundColor: colors.accentSoft, color: colors.accent },
  pillDrop: { backgroundColor: '#FEE2E2', color: colors.danger },
  quick: { flexDirection: 'row', gap: 10, marginTop: 14 },
  actions: { flexDirection: 'row', alignItems: 'center', marginTop: 14, gap: 12 },
  applyButton: { flex: 1 },
  later: { paddingHorizontal: 8, paddingVertical: 10 },
  laterText: { color: colors.muted, fontWeight: '600', fontSize: 15 },
});
