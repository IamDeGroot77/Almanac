import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors } from '../theme';
import { almanacDayKeyFromOffset, almanacDayFromOffset } from '../clock';

// Seven days starting today. Each cell shows the weekday, date, and a count
// of open tasks on that day's list plus things due that day. Tap to view.
export default function WeekStrip({ tasks, selectedOffset, onSelect, forecast }) {
  const cells = Array.from({ length: 7 }, (_, offset) => {
    const key = almanacDayKeyFromOffset(offset);
    const date = almanacDayFromOffset(offset);
    const onList = tasks.filter((t) => !t.done && !t.parentId && t.listId === `day:${key}`).length;
    const due = tasks.filter((t) => !t.done && !t.parentId && t.due === key && t.listId !== `day:${key}`).length;
    const overdue = offset === 0 ? tasks.filter((t) => !t.done && !t.parentId && t.due && t.due < key).length : 0;
    const weather = forecast?.days.find((d) => d.date === key);
    return { offset, key, date, count: onList + due, overdue, weather };
  });
  return (
    <View style={styles.row}>
      {cells.map((c) => {
        const active = c.offset === selectedOffset;
        return (
          <TouchableOpacity
            key={c.key}
            style={[styles.cell, active && styles.cellActive]}
            onPress={() => onSelect(c.offset)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={`${c.date.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}, ${c.count} things`}
          >
            <Text style={[styles.weekday, active && styles.textActive]}>
              {c.date.toLocaleDateString([], { weekday: 'short' }).slice(0, 2)}
            </Text>
            <Text style={[styles.date, active && styles.textActive]}>{c.date.getDate()}</Text>
            {c.weather ? <Text style={[styles.temp, active && styles.textActive]}>{c.weather.high}°</Text> : null}
            <View style={styles.dots}>
              {c.count > 0 ? (
                <Text style={[styles.count, active && styles.textActive, c.overdue > 0 && styles.countOverdue]}>
                  {c.count}
                </Text>
              ) : (
                <Text style={[styles.count, styles.countEmpty]}> </Text>
              )}
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 4, marginTop: 14 },
  cell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.line,
  },
  cellActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  weekday: { fontSize: 10, fontWeight: '700', color: colors.muted, textTransform: 'uppercase' },
  date: { fontSize: 15, fontWeight: '700', color: colors.ink, marginTop: 2 },
  temp: { fontSize: 10, color: colors.muted, marginTop: 1 },
  dots: { marginTop: 3, minHeight: 14 },
  count: { fontSize: 11, fontWeight: '700', color: colors.accent },
  countOverdue: { color: colors.danger },
  countEmpty: { color: 'transparent' },
  textActive: { color: colors.onAccent },
});
