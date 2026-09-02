import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { colors, shared } from '../theme';
import { dayListIdForOffset, personOf } from '../store';
import { almanacToday, almanacDayKeyFromOffset } from '../clock';
import { describeDue, parseDueInput, parseTimeInput, formatTime24 } from '../due';
import { formatDuration } from '../durations';
import PersonChips from './PersonChips';

const ESTIMATES = [5, 15, 30, 60, 120].map((m) => ({ label: formatDuration(m * 60000), ms: m * 60000 }));
const TIMES = ['09:00', '12:00', '17:00', '20:00'];

// Everything about one task: who it's for, when it's due, how long you
// think it'll take, and where it lives.
export default function TaskSheet({
  task,
  lists,
  people,
  onSetPerson,
  onSetDue,
  onSetEstimate,
  onSetNotes,
  onMove,
  onClose,
  steps, // { all, open, done } for this task
  onAddStep,
  onBreakDown,
  onToggleStep,
  onDeleteStep,
}) {
  const [stepText, setStepText] = useState('');
  const [customDue, setCustomDue] = useState('');
  const [customTime, setCustomTime] = useState('');
  const [dueError, setDueError] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    setCustomDue('');
    setCustomTime('');
    setDueError('');
    setNotes(task?.notes || '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task?.id]);

  const close = () => {
    if (task && (notes || '') !== (task.notes || '')) onSetNotes(task.id, notes);
    onClose();
  };

  if (!task) return null;

  const destinations = [
    { id: dayListIdForOffset(0), name: 'Today' },
    { id: dayListIdForOffset(1), name: 'Tomorrow' },
    ...lists.map((l) => ({ id: l.id, name: l.name })),
  ].filter((d) => d.id !== task.listId);

  const today = almanacToday();
  const tomorrow = almanacDayKeyFromOffset(1);

  const applyCustomDue = () => {
    const key = parseDueInput(customDue);
    if (!key) {
      setDueError('Try "9/15", "15", "tomorrow", or "fri".');
      return;
    }
    setDueError('');
    onSetDue(task.id, key, task.dueTime);
    setCustomDue('');
  };

  const applyCustomTime = () => {
    const t = parseTimeInput(customTime);
    if (!t) {
      setDueError('Try "8", "8:30", "5pm".');
      return;
    }
    setDueError('');
    onSetDue(task.id, task.due || today, t);
    setCustomTime('');
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={close}>
      <KeyboardAvoidingView style={styles.wrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={styles.backdrop} onPress={close} accessibilityLabel="Close">
          <Pressable style={styles.sheet} onPress={() => {}}>
            <ScrollView keyboardShouldPersistTaps="handled" style={styles.scroll}>
              <Text style={styles.title} numberOfLines={2}>
                {task.text}
              </Text>

              <Text style={styles.label}>For</Text>
              <PersonChips
                people={people}
                selected={personOf(task)}
                onSelect={(id) => onSetPerson(task.id, id)}
                compact
              />

              <Text style={[styles.label, styles.spaced]}>Due {task.due ? `· ${describeDue(task)}` : ''}</Text>
              <View style={styles.chips}>
                <Chip label="None" active={!task.due} onPress={() => onSetDue(task.id, null, null)} />
                <Chip label="Today" active={task.due === today} onPress={() => onSetDue(task.id, today, task.dueTime)} />
                <Chip label="Tomorrow" active={task.due === tomorrow} onPress={() => onSetDue(task.id, tomorrow, task.dueTime)} />
              </View>
              <View style={styles.inputRow}>
                <TextInput
                  style={[shared.input, styles.smallInput]}
                  value={customDue}
                  onChangeText={setCustomDue}
                  placeholder="Other day: 9/15, fri…"
                  placeholderTextColor={colors.muted}
                  returnKeyType="done"
                  onSubmitEditing={applyCustomDue}
                />
                <TouchableOpacity style={styles.apply} onPress={applyCustomDue} accessibilityRole="button">
                  <Text style={styles.applyText}>Set</Text>
                </TouchableOpacity>
              </View>

              {task.due ? (
                <View>
                  <Text style={[styles.label, styles.spacedSmall]}>
                    Remind at {task.dueTime ? `· ${formatTime24(task.dueTime)}` : ''}
                  </Text>
                  <View style={styles.chips}>
                    <Chip label="No time" active={!task.dueTime} onPress={() => onSetDue(task.id, task.due, null)} />
                    {TIMES.map((t) => (
                      <Chip
                        key={t}
                        label={formatTime24(t)}
                        active={task.dueTime === t}
                        onPress={() => onSetDue(task.id, task.due, t)}
                      />
                    ))}
                  </View>
                  <View style={styles.inputRow}>
                    <TextInput
                      style={[shared.input, styles.smallInput]}
                      value={customTime}
                      onChangeText={setCustomTime}
                      placeholder="Other time: 8:30, 5pm…"
                      placeholderTextColor={colors.muted}
                      returnKeyType="done"
                      onSubmitEditing={applyCustomTime}
                    />
                    <TouchableOpacity style={styles.apply} onPress={applyCustomTime} accessibilityRole="button">
                      <Text style={styles.applyText}>Set</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : null}
              {dueError ? <Text style={styles.error}>{dueError}</Text> : null}

              <Text style={[styles.label, styles.spaced]}>
                Estimate {task.estimateMs ? `· ${formatDuration(task.estimateMs)}` : ''}
              </Text>
              <View style={styles.chips}>
                <Chip label="None" active={!task.estimateMs} onPress={() => onSetEstimate(task.id, null)} />
                {ESTIMATES.map((e) => (
                  <Chip
                    key={e.ms}
                    label={e.label}
                    active={task.estimateMs === e.ms}
                    onPress={() => onSetEstimate(task.id, e.ms)}
                  />
                ))}
              </View>

              {!task.parentId && (
                <View>
                  <Text style={[styles.label, styles.spaced]}>
                    Steps {steps && steps.all.length ? `· ${steps.done.length}/${steps.all.length}` : ''}
                  </Text>
                  {steps?.all.map((st) => (
                    <View key={st.id} style={[styles.stepRow, shared.hairline]}>
                      <TouchableOpacity
                        style={styles.stepMain}
                        onPress={() => onToggleStep(st.id)}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: st.done }}
                      >
                        <Text style={[styles.stepBox, st.done && styles.stepBoxDone]}>{st.done ? '✓' : ''}</Text>
                        <Text style={[styles.stepText, st.done && styles.stepTextDone]}>
                          {st.text}
                          {st.due ? <Text style={styles.stepDue}>  {describeDue(st)}</Text> : null}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => onDeleteStep(st.id)} hitSlop={10} accessibilityLabel="Remove step">
                        <Text style={styles.stepRemove}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                  <View style={styles.inputRow}>
                    <TextInput
                      style={[shared.input, styles.smallInput]}
                      value={stepText}
                      onChangeText={setStepText}
                      placeholder="Add a step, the smaller the better"
                      placeholderTextColor={colors.muted}
                      returnKeyType="done"
                      submitBehavior="submit"
                      onSubmitEditing={() => {
                        onAddStep(task.id, stepText);
                        setStepText('');
                      }}
                    />
                    <TouchableOpacity
                      style={styles.apply}
                      onPress={() => {
                        onAddStep(task.id, stepText);
                        setStepText('');
                      }}
                      accessibilityRole="button"
                    >
                      <Text style={styles.applyText}>Add</Text>
                    </TouchableOpacity>
                  </View>
                  {(!steps || steps.all.length === 0) && (
                    <View style={styles.breakRow}>
                      <Chip label="Break it down" active={false} onPress={() => onBreakDown(task.id)} />
                      <Text style={styles.breakHint}>
                        Starter steps for this kind of task{task.due ? ', spread out to the due date' : ''}. Edit freely.
                      </Text>
                    </View>
                  )}
                </View>
              )}

              <Text style={[styles.label, styles.spaced]}>Notes</Text>
              <TextInput
                style={[shared.input, styles.notes]}
                value={notes}
                onChangeText={setNotes}
                onBlur={() => onSetNotes(task.id, notes)}
                onEndEditing={() => onSetNotes(task.id, notes)}
                placeholder="Details, links, where things are…"
                placeholderTextColor={colors.muted}
                multiline
              />

              <Text style={[styles.label, styles.spaced]}>Move to</Text>
              {destinations.map((d) => (
                <TouchableOpacity
                  key={d.id}
                  style={[styles.option, shared.hairline]}
                  onPress={() => onMove(task.id, d.id)}
                  accessibilityRole="button"
                >
                  <Text style={styles.optionText}>{d.name}</Text>
                </TouchableOpacity>
              ))}

              <TouchableOpacity style={styles.done} onPress={close} accessibilityRole="button">
                <Text style={styles.doneText}>Done</Text>
              </TouchableOpacity>
            </ScrollView>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function Chip({ label, active, onPress }) {
  return (
    <TouchableOpacity
      style={[styles.chip, active && styles.chipActive]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '85%',
  },
  scroll: { padding: 20, paddingBottom: 32 },
  title: { fontSize: 17, fontWeight: '700', color: colors.ink, marginBottom: 14 },
  label: { fontSize: 13, fontWeight: '600', color: colors.muted, marginBottom: 8 },
  spaced: { marginTop: 18 },
  spacedSmall: { marginTop: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.line,
  },
  chipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { fontSize: 13, fontWeight: '600', color: colors.ink },
  chipTextActive: { color: colors.onAccent },
  inputRow: { flexDirection: 'row', gap: 8, marginTop: 8, alignItems: 'center' },
  smallInput: { paddingVertical: 8, fontSize: 14 },
  notes: { flex: 0, minHeight: 64, textAlignVertical: 'top' },
  stepRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  stepMain: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  stepBox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: colors.accent,
    textAlign: 'center',
    lineHeight: 18,
    fontSize: 12,
    color: colors.onAccent,
    marginRight: 10,
  },
  stepBoxDone: { backgroundColor: colors.accent },
  stepText: { flex: 1, fontSize: 15, color: colors.ink },
  stepTextDone: { color: colors.muted, textDecorationLine: 'line-through' },
  stepDue: { fontSize: 12, color: colors.muted },
  stepRemove: { color: colors.muted, fontSize: 15, paddingHorizontal: 8 },
  breakRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 },
  breakHint: { flex: 1, fontSize: 12, color: colors.muted },
  apply: { paddingHorizontal: 12, paddingVertical: 8 },
  applyText: { color: colors.accent, fontWeight: '600' },
  error: { color: colors.danger, fontSize: 12, marginTop: 6 },
  option: { paddingVertical: 14 },
  optionText: { fontSize: 17, color: colors.ink },
  done: { marginTop: 12, marginBottom: 20, alignItems: 'center', paddingVertical: 10 },
  doneText: { fontSize: 16, color: colors.accent, fontWeight: '600' },
});
