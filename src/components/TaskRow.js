import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, shared } from '../theme';
import { formatDuration, useNow, elapsedFor, isRunning, isPaused } from '../durations';
import { describeDue, dueStatus } from '../due';

// A task is not started, running, paused, or done.
//  - tapping the circle toggles done / not started (instant check-off)
//  - Start begins timing; Pause banks it; Finish completes and records it
//  - long press opens the task sheet
export default function TaskRow({ task, tag, context, steps, isStep, onToggle, onStart, onPause, onFinish, onDelete, onLongPress }) {
  const running = isRunning(task);
  const paused = isPaused(task);
  const now = useNow(running);
  const elapsed = elapsedFor(task, now);

  const meta = [];
  if (context) meta.push({ text: context });
  if (steps && steps.all.length > 0) {
    const next = steps.open[0];
    meta.push({
      text: next ? `Next: ${next.text}` : 'All steps done',
      active: !!next && !task.done,
    });
    meta.push({ text: `${steps.done.length}/${steps.all.length} steps` });
  }
  if (task.canvasCourse) {
    meta.push({
      text:
        task.canvasScore != null && task.canvasPoints
          ? `${task.canvasCourse} · ${task.canvasScore}/${task.canvasPoints}`
          : task.canvasCourse,
    });
  }
  if (task.notes?.trim()) meta.push({ text: `≡ ${task.notes.trim().split('\n')[0].slice(0, 40)}` });
  if (task.done && elapsed != null) {
    meta.push({
      text: task.estimateMs ? `${formatDuration(elapsed)} (est ${formatDuration(task.estimateMs)})` : formatDuration(elapsed),
    });
  } else if (running) {
    meta.push({
      text: task.estimateMs ? `${formatDuration(elapsed)} of ~${formatDuration(task.estimateMs)}` : `${formatDuration(elapsed)} so far`,
      active: true,
    });
  } else if (paused) {
    meta.push({
      text: `${formatDuration(elapsed)} so far · paused${task.estimateMs ? ` · ~${formatDuration(task.estimateMs)}` : ''}`,
    });
  } else if (task.estimateMs) {
    meta.push({ text: `~${formatDuration(task.estimateMs)}` });
  }
  const due = dueStatus(task);
  if (task.due && !task.done) {
    meta.push({ text: `Due ${describeDue(task)}`, overdue: due === 'overdue', today: due === 'today' });
  }

  return (
    <View style={[styles.row, shared.hairline, isStep && styles.stepRow]}>
      <TouchableOpacity
        style={styles.main}
        onPress={() => onToggle(task.id)}
        onLongPress={() => onLongPress(task)}
        delayLongPress={350}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: task.done }}
        accessibilityHint="Long press for options"
      >
        <View style={[styles.circle, (running || paused) && styles.circleActive, task.done && styles.circleDone]}>
          {task.done ? <Text style={styles.check}>✓</Text> : null}
          {running ? <View style={styles.dot} /> : null}
          {paused ? <View style={styles.pauseMark} /> : null}
        </View>
        <View style={styles.body}>
          <View style={styles.textRow}>
            <Text style={[styles.text, isStep && styles.stepText, task.done && styles.textDone]}>{task.text}</Text>
            {tag ? <Text style={styles.tag}>{tag}</Text> : null}
          </View>
          {meta.length > 0 ? (
            <Text style={styles.meta} numberOfLines={1}>
              {meta.map((m, i) => (
                <Text key={i} style={[m.active && styles.metaActive, m.overdue && styles.metaOverdue, m.today && styles.metaToday]}>
                  {i > 0 ? ' · ' : ''}
                  {m.text}
                </Text>
              ))}
            </Text>
          ) : null}
        </View>
      </TouchableOpacity>

      {!task.done && !running && (
        <Action label={paused ? 'Resume' : 'Start'} onPress={() => onStart(task.id)} hint={task.text} />
      )}
      {running && <Action label="Pause" onPress={() => onPause(task.id)} hint={task.text} />}
      {(running || paused) && <Action label="Finish" primary onPress={() => onFinish(task.id)} hint={task.text} />}

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

function Action({ label, primary, onPress, hint }) {
  return (
    <TouchableOpacity
      style={[styles.action, primary && styles.actionPrimary]}
      onPress={onPress}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={`${label} ${hint}`}
    >
      <Text style={[styles.actionText, primary && styles.actionTextPrimary]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 6 },
  stepRow: { paddingVertical: 7 },
  stepText: { fontSize: 15 },
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
  pauseMark: { width: 8, height: 8, borderRadius: 1, backgroundColor: colors.muted },
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
  action: { borderWidth: 1, borderColor: colors.line, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 5 },
  actionPrimary: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  actionText: { fontSize: 13, fontWeight: '600', color: colors.muted },
  actionTextPrimary: { color: colors.accent },
  delete: { color: colors.muted, fontSize: 16, paddingHorizontal: 4 },
});
