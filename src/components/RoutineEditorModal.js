import { useEffect, useState } from 'react';
import {
  Alert,
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
import { PrimaryButton, SmallButton } from './Buttons';
import PersonChips from './PersonChips';
import { newId } from '../ids';
import { WEEKDAYS, describeDays } from '../routines';

// Create or edit a routine: name, cadence, who it's for, and its items.
export default function RoutineEditorModal({ routine, lists, routines = [], people, onSave, onDelete, onClose }) {
  const editing = !!routine?.id;
  const [name, setName] = useState('');
  const [cadence, setCadence] = useState('daily');
  const [personId, setPersonId] = useState('me');
  const [items, setItems] = useState([]);

  const [itemText, setItemText] = useState('');
  const [itemDays, setItemDays] = useState([]);
  const [quotaListId, setQuotaListId] = useState(null);
  const [quotaCount, setQuotaCount] = useState(1);
  const [quotaMode, setQuotaMode] = useState('items'); // items | minutes
  const [minutesPerDay, setMinutesPerDay] = useState(0);
  const [warmup, setWarmup] = useState(false);

  useEffect(() => {
    if (!routine) return;
    setName(routine.name || '');
    setCadence(routine.cadence || 'daily');
    setPersonId(routine.personId || 'me');
    setItems(routine.items || []);
    setMinutesPerDay(routine.minutesPerDay || 0);
    setWarmup(!!routine.warmup);
    setItemText('');
    setItemDays([]);
    setQuotaListId(lists[0]?.id || null);
    setQuotaCount(1);
  }, [routine, lists]);

  if (!routine) return null;

  const addPlain = () => {
    const text = itemText.trim();
    if (!text) return;
    setItems([...items, { id: newId('ri'), type: 'task', text, days: cadence === 'daily' ? itemDays : [] }]);
    setItemText('');
    setItemDays([]);
  };

  const addQuota = () => {
    if (!quotaListId) return;
    const item = quotaListId.startsWith('r:')
      ? quotaMode === 'minutes'
        ? { id: newId('ri'), type: 'minutes', routineId: quotaListId.slice(2), minutes: quotaCount }
        : { id: newId('ri'), type: 'quota', routineId: quotaListId.slice(2), count: quotaCount }
      : { id: newId('ri'), type: 'quota', listId: quotaListId, count: quotaCount };
    setItems([...items, item]);
    setQuotaCount(1);
  };
  const otherRoutines = routines.filter((r) => r.id !== routine?.id);
  const sourceName = (it) =>
    it.routineId ? routines.find((r) => r.id === it.routineId)?.name || 'a deleted routine' : listName(it.listId);

  const removeItem = (id) => setItems(items.filter((it) => it.id !== id));

  const save = () => {
    if (!name.trim()) return;
    onSave({ ...routine, name: name.trim(), cadence, personId, items, minutesPerDay: minutesPerDay || null, warmup });
    onClose();
  };

  const confirmDelete = () =>
    Alert.alert(`Delete "${routine.name}"?`, 'Past progress is removed too.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          onDelete(routine.id);
          onClose();
        },
      },
    ]);

  const toggleDay = (d) =>
    setItemDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));

  const listName = (id) => lists.find((l) => l.id === id)?.name || 'a deleted list';

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.wrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close">
          <Pressable style={styles.sheet} onPress={() => {}}>
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scroll}>
              <Text style={styles.title}>{editing ? 'Edit routine' : 'New routine'}</Text>
              <Text style={styles.hint}>
                A routine starts over every day or every week. Add plain items to tick off, or quotas
                like "3 from Groceries" that count themselves as you finish tasks on that list.
              </Text>

              <TextInput
                style={[shared.input, styles.nameInput]}
                value={name}
                onChangeText={setName}
                placeholder="Routine name, e.g. Daily or This week"
                placeholderTextColor={colors.muted}
                autoFocus={!editing}
              />

              <Text style={styles.label}>Repeats</Text>
              <View style={styles.segment}>
                {['daily', 'weekly'].map((c) => (
                  <TouchableOpacity
                    key={c}
                    style={[styles.segmentButton, cadence === c && styles.segmentActive]}
                    onPress={() => setCadence(c)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: cadence === c }}
                  >
                    <Text style={[styles.segmentText, cadence === c && styles.segmentTextActive]}>
                      {c === 'daily' ? 'Every day' : 'Every week'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>For</Text>
              <PersonChips people={people} selected={personId} onSelect={setPersonId} compact />

              <Text style={styles.label}>Minutes a day (a minute is a point; 0 = untimed)</Text>
              <PersonChips
                people={[0, 10, 15, 20, 30, 45, 60].map((m) => ({ id: String(m), name: m ? `${m} min` : 'Off' }))}
                selected={String(minutesPerDay)}
                onSelect={(id) => setMinutesPerDay(Number(id))}
                compact
              />
              <TouchableOpacity onPress={() => setWarmup(!warmup)} style={styles.toggleRow} accessibilityRole="checkbox" accessibilityState={{ checked: warmup }}>
                <View style={[styles.toggleBox, warmup && styles.toggleBoxOn]}>{warmup ? <Text style={styles.toggleCheck}>✓</Text> : null}</View>
                <Text style={styles.toggleText}>Suggest a stretch before the first item in an hour</Text>
              </TouchableOpacity>

              <Text style={styles.label}>Items</Text>
              {items.length === 0 && <Text style={shared.muted}>No items yet.</Text>}
              {items.map((it) => (
                <View key={it.id} style={[styles.itemRow, shared.hairline]}>
                  <View style={styles.itemBody}>
                    <Text style={styles.itemText}>
                      {it.type === 'task' ? it.text : it.type === 'minutes' ? `${it.minutes} min from ${sourceName(it)}` : `${it.count} from ${sourceName(it)}`}
                    </Text>
                    {it.type === 'task' && cadence === 'daily' ? (
                      <Text style={styles.itemMeta}>{describeDays(it.days)}</Text>
                    ) : null}
                  </View>
                  <TouchableOpacity onPress={() => removeItem(it.id)} hitSlop={10} accessibilityLabel="Remove item">
                    <Text style={styles.remove}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}

              <Text style={[styles.label, styles.spaced]}>Add an item</Text>
              <View style={styles.inputRow}>
                <TextInput
                  style={shared.input}
                  value={itemText}
                  onChangeText={setItemText}
                  placeholder="e.g. Exercise, Read with Zeke"
                  placeholderTextColor={colors.muted}
                  returnKeyType="done"
                  onSubmitEditing={addPlain}
                  submitBehavior="submit"
                />
                <SmallButton label="Add" onPress={addPlain} />
              </View>
              {cadence === 'daily' && (
                <View style={styles.days}>
                  {WEEKDAYS.map((d, i) => (
                    <TouchableOpacity
                      key={i}
                      style={[styles.day, itemDays.includes(i) && styles.dayActive]}
                      onPress={() => toggleDay(i)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: itemDays.includes(i) }}
                    >
                      <Text style={[styles.dayText, itemDays.includes(i) && styles.dayTextActive]}>{d}</Text>
                    </TouchableOpacity>
                  ))}
                  <Text style={styles.daysHint}>{itemDays.length ? describeDays(itemDays) : 'Every day'}</Text>
                </View>
              )}

              <Text style={[styles.label, styles.spaced]}>Add a quota</Text>
              {lists.length === 0 && otherRoutines.length === 0 ? (
                <Text style={shared.muted}>Create a named list or another routine first, then you can add "N from it".</Text>
              ) : (
                <View>
                  <View style={styles.quotaRow}>
                    <View style={styles.stepper}>
                      <TouchableOpacity onPress={() => setQuotaCount(Math.max(1, quotaCount - 1))} style={styles.step} accessibilityLabel="Fewer">
                        <Text style={styles.stepText}>−</Text>
                      </TouchableOpacity>
                      <Text style={styles.stepValue}>{quotaCount}</Text>
                      <TouchableOpacity onPress={() => setQuotaCount(quotaCount + 1)} style={styles.step} accessibilityLabel="More">
                        <Text style={styles.stepText}>+</Text>
                      </TouchableOpacity>
                    </View>
                    <Text style={styles.from}>{quotaMode === 'minutes' ? 'min from' : 'from'}</Text>
                    {quotaListId?.startsWith('r:') ? (
                      <SmallButton label={quotaMode === 'minutes' ? 'Count minutes' : 'Count items'} onPress={() => setQuotaMode(quotaMode === 'minutes' ? 'items' : 'minutes')} />
                    ) : null}
                  </View>
                  <PersonChips
                    people={[...lists.map((l) => ({ id: l.id, name: l.name })), ...otherRoutines.map((r) => ({ id: `r:${r.id}`, name: `${r.name} (routine)` }))]}
                    selected={quotaListId}
                    onSelect={setQuotaListId}
                    compact
                  />
                  <SmallButton label="Add quota" onPress={addQuota} style={styles.addQuota} />
                </View>
              )}

              <View style={styles.actions}>
                {editing ? (
                  <TouchableOpacity onPress={confirmDelete} style={styles.deleteButton} accessibilityRole="button">
                    <Text style={styles.deleteText}>Delete</Text>
                  </TouchableOpacity>
                ) : (
                  <View />
                )}
                <View style={styles.actionsRight}>
                  <TouchableOpacity onPress={onClose} style={styles.cancel} accessibilityRole="button">
                    <Text style={styles.cancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <PrimaryButton label={editing ? 'Save' : 'Create routine'} onPress={save} />
                </View>
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.bg, borderTopLeftRadius: 16, borderTopRightRadius: 16, maxHeight: '92%' },
  scroll: { padding: 20, paddingBottom: 36 },
  title: { fontSize: 20, fontWeight: '700', color: colors.ink },
  hint: { fontSize: 13, color: colors.muted, marginTop: 6, marginBottom: 14 },
  nameInput: { flex: 0 },
  label: { fontSize: 13, fontWeight: '600', color: colors.muted, marginTop: 16, marginBottom: 8 },
  spaced: { marginTop: 22 },
  segment: { flexDirection: 'row', backgroundColor: colors.accentSoft, borderRadius: 10, padding: 3 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  toggleBox: { width: 20, height: 20, borderRadius: 5, borderWidth: 1.5, borderColor: colors.accent, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  toggleBoxOn: { backgroundColor: colors.accent },
  toggleCheck: { color: colors.onAccent, fontSize: 12, fontWeight: '700' },
  toggleText: { fontSize: 14, color: colors.ink, flex: 1 },
  segmentButton: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  segmentActive: { backgroundColor: colors.bg },
  segmentText: { fontSize: 14, fontWeight: '600', color: colors.accent },
  segmentTextActive: { color: colors.ink },
  itemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  itemBody: { flex: 1 },
  itemText: { fontSize: 15, color: colors.ink },
  itemMeta: { fontSize: 12, color: colors.muted, marginTop: 1 },
  remove: { color: colors.muted, fontSize: 16, paddingHorizontal: 8 },
  inputRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  days: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, flexWrap: 'wrap' },
  day: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  dayText: { fontSize: 12, fontWeight: '700', color: colors.ink },
  dayTextActive: { color: colors.onAccent },
  daysHint: { fontSize: 12, color: colors.muted, marginLeft: 6 },
  quotaRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  stepper: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.line, borderRadius: 8 },
  step: { paddingHorizontal: 12, paddingVertical: 6 },
  stepText: { fontSize: 18, color: colors.accent, fontWeight: '700' },
  stepValue: { fontSize: 16, fontWeight: '700', color: colors.ink, minWidth: 24, textAlign: 'center' },
  from: { fontSize: 14, color: colors.muted },
  addQuota: { marginTop: 10 },
  actions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 28 },
  actionsRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  deleteButton: { paddingVertical: 10 },
  deleteText: { color: colors.danger, fontWeight: '600', fontSize: 15 },
  cancel: { paddingHorizontal: 8, paddingVertical: 10 },
  cancelText: { color: colors.muted, fontWeight: '600', fontSize: 15 },
});
