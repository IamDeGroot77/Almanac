import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';
import { useNow } from '../durations';
import { dueDateTime } from '../due';
import { parseDayKey } from '../dates';

// The day as a bar, so the size of the afternoon is visible rather than
// imagined. Events and deadlines are marks; a line shows now. Runs from the
// wake time (or 6 AM) to bedtime (or midnight).
export default function Timeline({ dayKey, events, dueTasks, wokeAt, sleptAt, isToday, blocks = [], blockColor = () => colors.accentSoft }) {
  const now = useNow(isToday, 60000);
  const dayStart = parseDayKey(dayKey).getTime();
  const start = wokeAt && isToday ? Math.min(wokeAt, dayStart + 6 * 3600000) : dayStart + 6 * 3600000;
  const end = sleptAt && isToday ? Math.max(sleptAt, start + 3600000) : dayStart + 24 * 3600000;
  const span = end - start;
  const pct = (t) => Math.max(0, Math.min(100, ((t - start) / span) * 100));

  const marks = [];
  for (const e of events || []) {
    if (e.allDay || !e.startMs) continue;
    marks.push({ at: e.startMs, label: e.title, kind: 'event' });
  }
  for (const t of dueTasks || []) {
    const d = dueDateTime(t);
    if (d && t.dueTime) marks.push({ at: d.getTime(), label: t.text, kind: 'due' });
  }
  marks.sort((a, b) => a.at - b.at);

  const hours = [];
  for (let h = Math.ceil((start - dayStart) / 3600000); h <= (end - dayStart) / 3600000; h += 3) {
    const t = dayStart + h * 3600000;
    hours.push({ at: t, label: h === 12 ? '12p' : h > 12 ? `${h - 12}p` : `${h}a` });
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.track}>
        {blocks.map((b) => (
          <View key={b.id} style={[styles.block, { left: `${pct(b.startMs)}%`, width: `${Math.max(1, pct(b.endMs) - pct(b.startMs))}%`, backgroundColor: blockColor(b.categoryId) }]} />
        ))}
        {isToday && now >= start && now <= end ? (
          <View style={[styles.past, { width: `${pct(now)}%` }]} />
        ) : null}
        {marks.map((m, i) => (
          <View key={i} style={[styles.mark, m.kind === 'due' ? styles.markDue : styles.markEvent, { left: `${pct(m.at)}%` }]} />
        ))}
        {isToday && now >= start && now <= end ? <View style={[styles.now, { left: `${pct(now)}%` }]} /> : null}
      </View>
      <View style={styles.hours}>
        {hours.map((h) => (
          <Text key={h.at} style={[styles.hour, { left: `${pct(h.at)}%` }]}>
            {h.label}
          </Text>
        ))}
      </View>
      {marks.length > 0 ? (
        <Text style={styles.legend} numberOfLines={2}>
          {marks
            .slice(0, 6)
            .map((m) => `${new Date(m.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} ${m.label}`)
            .join(' · ')}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { position: 'absolute', top: 0, bottom: 0, opacity: 0.35, borderRadius: 3 },
  wrap: { marginTop: 14 },
  track: { height: 10, borderRadius: 5, backgroundColor: colors.line, overflow: 'visible' },
  past: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: colors.accentSoft, borderRadius: 5 },
  mark: { position: 'absolute', top: -2, width: 6, height: 14, borderRadius: 3, marginLeft: -3 },
  markEvent: { backgroundColor: colors.accent },
  markDue: { backgroundColor: colors.danger },
  now: { position: 'absolute', top: -5, width: 2, height: 20, backgroundColor: colors.ink, marginLeft: -1 },
  hours: { height: 14, marginTop: 4 },
  hour: { position: 'absolute', fontSize: 10, color: colors.muted, marginLeft: -8 },
  legend: { fontSize: 11, color: colors.muted, marginTop: 4 },
});
