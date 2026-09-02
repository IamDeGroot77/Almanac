import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, shared } from '../theme';
import { formatDuration, useNow } from '../durations';
import { describeDue, dueStatus } from '../due';

// A task is not started, in progress (startedAt set), or done.
//  - tapping the circle toggles done / not started (instant check-off)
//  - Start begins timing, Finish completes it and records the duration
//  - long press opens the task sheet
export default function TaskRow({ task, tag, context, onToggle, onStart, onFinish, onDelete, onLongPress }) {
  const inProgress = !task.done && !!task.startedAt;
  const now = useNow(inProgress);

  const elapsed = task.done ? task.durationMs : inProgress ? now - task.startedAt : null;
  const meta = [];
  if (context) meta.push({ text: context });
  if (task.canvasCourse) {
    meta.push({
      text:
        task.canvasScore != null && task.canvasPoints
          ? `${task.canvasCourse} · ${task.canvasScore}/${task.canvasPoints}`
          : task.canvasCourse,
    });
  }
  if (task.done && elapsed != null) {
    meta.push({
      text: task.estimateMs ? `${formatDuration(elapsed)} (est ${formatDuration(task.estimateMs)})` : formatDuration(elapsed),
    });
  } else if (inProgress) {
    meta.push({
      text: task.estimateMs
        ? `${formatDuration(elapsed)} of ~${formatDuration(task.estimateMs)}`
        : `${formatDuration(elapsed)} so far`,
      active: true,
    });
  } else if (task.estimateMs) {
    meta.push({ text: `~${formatDuration(task.estimateMs)}` });
  }
  const due = dueStatus(task);
  if (task.due && !task.done) {
    meta.push({ text: `Due ${describeDue(task)}`, overdue: due === 'overdue', today: due === 'today' });
  }

  return (
    <View style={[styles.row, shared.hairline]}>
      <TouchableOpacity
        style={styles.main}
        onPress={() => onToggle(task.id)}
        onLongPress={() => onLongPress(task)}
        delayLongPress={350}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: task.done }}
        accessibilityHint="Long press for options"
      >
        <View style={[styles.circle, inProgress && styles.circleActive, task.done && styles.circleDone]}>
          {task.done ? <Text style={styles.check}>✓</Text> : null}
          {inProgress ? <View style={styles.dot} /> : null}
        </View>
        <View style={styles.body}>
          <View style={styles.textRow}>
            <Text style={[styles.text, task.done && styles.textDone]}>{task.text}</Text>
            {tag ? <Text style={styles.tag}>{tag}</Text> : null}
          </View>
          {meta.length > 0 ? (
            <Text style={styles.meta} numberOfLines={1}>
              {meta.map((m, i) => (
                <Text
                  key={i}
                  style={[m.active && styles.metaActive, m.overdue && styles.metaOverdue, m.today && styles.metaToday]}
                >
                  {i > 0 ? ' · ' : ''}
                  {m.text}
                </Text>
              ))}
            </Text>
          ) : null}
        </View>
      </TouchableOpacity>

      {!task.done && !inProgress && (
        <TouchableOpacity
          style={styles.action}
          onPress={() => onStart(task.id)}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`Start ${task.text}`}
        >
          <Text style={styles.actionText}>Start</Text>
        </TouchableOpacity>
      )}
      {inProgress && (
        <TouchableOpacity
          style={[styles.action, styles.actionPrimary]}
          onPress={() => onFinish(task.id)}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`Finish ${task.text}`}
        >
          <Text style={[styles.actionText, styles.actionTextPrimary]}>Finish</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity
        onPress={() => onDelete(task.id)}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel={`Delete ${task.text}`}
      >
        <Text style={styles.delete}>✕</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 8 },
  main: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  circle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  circleActive: { backgroundColor: colors.accentSoft },
  circleDone: { backgroundColor: colors.accent },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent },
  check: { color: '#FFFFFF', fontSize: 13, lineHeight: 15, fontWeight: '700' },
  body: { flex: 1 },
  textRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  text: { fontSize: 16, color: colors.ink, flexShrink: 1 },
  textDone: { textDecorationLine: 'line-through', color: colors.muted },
  tag: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.accent,
    backgroundColor: colors.accentSoft,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
    overflow: 'hidden',
  },
  meta: { fontSize: 12, color: colors.muted, marginTop: 1 },
  metaActive: { color: colors.accent },
  metaOverdue: { color: colors.danger, fontWeight: '600' },
  metaToday: { color: colors.warn, fontWeight: '600' },
  action: { borderWidth: 1, borderColor: colors.line, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  actionPrimary: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  actionText: { fontSize: 13, fontWeight: '600', color: colors.muted },
  actionTextPrimary: { color: colors.accent },
  delete: { color: colors.muted, fontSize: 16, paddingHorizontal: 6 },
});
