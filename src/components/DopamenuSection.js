import { useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { colors, shared } from '../theme';
import { SmallButton } from './Buttons';
import PersonChips from './PersonChips';
import { newId } from '../ids';

const KINDS = [
  { id: 'appetizer', name: 'Appetizer · 2 min' },
  { id: 'side', name: 'Side · pair with a task' },
  { id: 'dessert', name: 'Dessert · short, scroll risk' },
];

// Settings: the dopamine menu, written when you're fine, for when you're not.
export default function DopamenuSection({ menu, onChange }) {
  const [text, setText] = useState('');
  const [kind, setKind] = useState('appetizer');
  const add = () => {
    const t = text.trim();
    if (!t) return;
    onChange([...(menu || []), { id: newId('dm'), text: t, kind }]);
    setText('');
  };
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Dopamine menu</Text>
      <Text style={shared.muted}>
        Small good things for low-energy moments. When an energy check-in comes back Low, Today shows two or three
        of these before the task list. Appetizers take two minutes (a song, step outside, cold water). Sides go with
        a boring task (a podcast while doing dishes). Desserts are the fun that eats an hour if unwatched.
      </Text>
      {(menu || []).map((m) => (
        <View key={m.id} style={[styles.row, shared.hairline]}>
          <View style={styles.body}>
            <Text style={styles.text}>{m.text}</Text>
            <Text style={styles.meta}>{KINDS.find((k) => k.id === m.kind)?.name || m.kind}</Text>
          </View>
          <TouchableOpacity onPress={() => onChange(menu.filter((x) => x.id !== m.id))} hitSlop={10} accessibilityLabel="Remove">
            <Text style={styles.remove}>✕</Text>
          </TouchableOpacity>
        </View>
      ))}
      <View style={styles.form}>
        <TextInput style={shared.input} value={text} onChangeText={setText} placeholder="e.g. one song, loud" placeholderTextColor={colors.muted} onSubmitEditing={add} />
        <PersonChips people={KINDS} selected={kind} onSelect={setKind} compact />
        <SmallButton label="Add" onPress={add} style={styles.add} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 28 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.ink, marginBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  body: { flex: 1 },
  text: { fontSize: 15, color: colors.ink },
  meta: { fontSize: 12, color: colors.muted, marginTop: 2 },
  remove: { color: colors.muted, fontSize: 16, paddingHorizontal: 8 },
  form: { marginTop: 10, gap: 8 },
  add: { alignSelf: 'flex-start' },
});
