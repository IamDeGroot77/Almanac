import { useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { colors, shared } from '../theme';
import { SmallButton } from './Buttons';
import PersonChips from './PersonChips';
import { newId } from '../ids';
import { parseTimeInput, formatTime24 } from '../due';
import { describeBlockDays, colorForCategory } from '../blocks';

const DAY_PRESETS = [
  { id: 'weekdays', name: 'Weekdays', days: [1, 2, 3, 4, 5] },
  { id: 'weekends', name: 'Weekends', days: [0, 6] },
  { id: 'every', name: 'Every day', days: [] },
];
const LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

// Settings: categories of lists, and the blocks of the day reserved for them.
export default function DayPlanSection({ categories, lists, blocks, onAddCategory, onRenameCategory, onDeleteCategory, onSetBlocks }) {
  const [newCategory, setNewCategory] = useState('');
  const [categoryId, setCategoryId] = useState(categories[0]?.id || null);
  const [start, setStart] = useState('1:00 pm');
  const [end, setEnd] = useState('4:00 pm');
  const [days, setDays] = useState([1, 2, 3, 4, 5]);
  const catName = (id) => categories.find((c) => c.id === id)?.name || 'a deleted category';
  const listsIn = (id) => lists.filter((l) => l.categoryId === id).map((l) => l.name);

  const addBlock = () => {
    const s = parseTimeInput(start);
    const e = parseTimeInput(end);
    const cid = categoryId || categories[0]?.id;
    if (!s || !e || !cid) return;
    onSetBlocks([...(blocks || []), { id: newId('b'), categoryId: cid, start: s, end: e, days }]);
  };
  const toggleDay = (d) => setDays(days.includes(d) ? days.filter((x) => x !== d) : [...days, d]);

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Categories and day blocks</Text>
      <Text style={shared.muted}>
        Categories group lists (Work: GFD, Reporter, School). A block reserves part of the day for a category; while
        it runs, Today shows the best next tasks from every list in that category and "Just one thing" picks from them.
      </Text>

      <Text style={styles.label}>Categories</Text>
      {categories.length === 0 ? <Text style={shared.muted}>None yet. Add one below, then set each list's category in its options.</Text> : null}
      {categories.map((c) => (
        <View key={c.id} style={[styles.row, shared.hairline]}>
          <View style={[styles.dot, { backgroundColor: colorForCategory(categories, c.id) }]} />
          <View style={styles.body}>
            <Text style={styles.text}>{c.name}</Text>
            <Text style={styles.meta}>{listsIn(c.id).join(', ') || 'no lists yet'}</Text>
          </View>
          <TouchableOpacity onPress={() => onDeleteCategory(c.id)} hitSlop={10} accessibilityLabel="Remove category">
            <Text style={styles.remove}>✕</Text>
          </TouchableOpacity>
        </View>
      ))}
      <View style={styles.inputRow}>
        <TextInput style={[shared.input, styles.input]} value={newCategory} onChangeText={setNewCategory} placeholder="New category, e.g. Work" placeholderTextColor={colors.muted} />
        <SmallButton
          label="Add"
          onPress={() => {
            if (!newCategory.trim()) return;
            onAddCategory(newCategory.trim());
            setNewCategory('');
          }}
        />
      </View>

      <Text style={styles.label}>Blocks</Text>
      {(blocks || []).map((b) => (
        <View key={b.id} style={[styles.row, shared.hairline]}>
          <View style={[styles.dot, { backgroundColor: colorForCategory(categories, b.categoryId) }]} />
          <View style={styles.body}>
            <Text style={styles.text}>
              {catName(b.categoryId)} · {formatTime24(b.start)} – {formatTime24(b.end)}
            </Text>
            <Text style={styles.meta}>{describeBlockDays(b.days)}</Text>
          </View>
          <TouchableOpacity onPress={() => onSetBlocks(blocks.filter((x) => x.id !== b.id))} hitSlop={10} accessibilityLabel="Remove block">
            <Text style={styles.remove}>✕</Text>
          </TouchableOpacity>
        </View>
      ))}
      {categories.length === 0 ? null : (
        <View style={styles.form}>
          <PersonChips people={categories.map((c) => ({ id: c.id, name: c.name }))} selected={categoryId || categories[0]?.id} onSelect={setCategoryId} compact />
          <View style={styles.inputRow}>
            <TextInput style={[shared.input, styles.time]} value={start} onChangeText={setStart} placeholder="1:00 pm" placeholderTextColor={colors.muted} />
            <Text style={shared.muted}>to</Text>
            <TextInput style={[shared.input, styles.time]} value={end} onChangeText={setEnd} placeholder="4:00 pm" placeholderTextColor={colors.muted} />
          </View>
          <View style={styles.daysRow}>
            {LETTERS.map((l, i) => (
              <TouchableOpacity key={i} onPress={() => toggleDay(i)} style={[styles.day, days.includes(i) && styles.dayOn]} accessibilityRole="button">
                <Text style={[styles.dayText, days.includes(i) && styles.dayTextOn]}>{l}</Text>
              </TouchableOpacity>
            ))}
            {DAY_PRESETS.map((p) => (
              <SmallButton key={p.id} label={p.name} onPress={() => setDays(p.days)} />
            ))}
          </View>
          <SmallButton label="Add block" onPress={addBlock} style={styles.add} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 28 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.ink, marginBottom: 6 },
  label: { fontSize: 13, fontWeight: '600', color: colors.muted, marginTop: 14, marginBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 10 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  body: { flex: 1 },
  text: { fontSize: 15, color: colors.ink },
  meta: { fontSize: 12, color: colors.muted, marginTop: 2 },
  remove: { color: colors.muted, fontSize: 16, paddingHorizontal: 8 },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  input: { flex: 1 },
  time: { flex: 0, width: 100, paddingVertical: 6 },
  form: { marginTop: 8, gap: 4 },
  daysRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  day: { width: 30, height: 30, borderRadius: 15, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  dayOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  dayText: { fontSize: 12, color: colors.muted, fontWeight: '600' },
  dayTextOn: { color: colors.onAccent },
  add: { alignSelf: 'flex-start', marginTop: 8 },
});
