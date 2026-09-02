import { useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { colors, shared } from '../theme';
import { SmallButton } from './Buttons';
import { liveScratch, staleScratch, describeScratchAge } from '../scratch';
import { useNow } from '../durations';

// Working memory at the top of Today. Two-second capture, and every note is
// one tap from becoming a task, a journal entry, or nothing.
export default function ScratchCard({ scratch, onAdd, onEdit, onRemove, onToTask, onToJournal, onClearStale }) {
  const now = useNow(true, 60000);
  const [text, setText] = useState('');
  const [editing, setEditing] = useState(null); // { id, text }
  const notes = liveScratch(scratch);
  const stale = staleScratch(scratch, now);

  const add = () => {
    const t = text.trim();
    if (!t) return;
    onAdd(t);
    setText('');
  };

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>Working memory</Text>
        {stale.length ? <SmallButton label={`Clear ${stale.length} old`} onPress={onClearStale} /> : null}
      </View>
      <View style={styles.inputRow}>
        <TextInput
          style={[shared.input, styles.input]}
          value={text}
          onChangeText={setText}
          placeholder="Hold a thought…"
          placeholderTextColor={colors.muted}
          onSubmitEditing={add}
          blurOnSubmit={false}
          returnKeyType="done"
        />
        <SmallButton label="Hold" onPress={add} />
      </View>
      {notes.length === 0 ? <Text style={styles.empty}>Empty. Good.</Text> : null}
      {notes.map((n) =>
        editing?.id === n.id ? (
          <View key={n.id} style={styles.row}>
            <TextInput style={[shared.input, styles.input]} value={editing.text} onChangeText={(t) => setEditing({ ...editing, text: t })} autoFocus onSubmitEditing={() => { onEdit(n.id, editing.text); setEditing(null); }} />
            <SmallButton label="Save" onPress={() => { onEdit(n.id, editing.text); setEditing(null); }} />
          </View>
        ) : (
          <View key={n.id} style={styles.row}>
            <TouchableOpacity style={styles.body} onLongPress={() => setEditing({ id: n.id, text: n.text })} delayLongPress={350} accessibilityRole="button" accessibilityHint="Long press to edit">
              <Text style={styles.text}>{n.text}</Text>
              <Text style={styles.meta}>
                {describeScratchAge(n, now)}
                {n.source === 'voice' ? ' · spoken' : ''}
              </Text>
            </TouchableOpacity>
            <SmallButton label="Task" onPress={() => onToTask(n.id)} />
            <SmallButton label="Journal" onPress={() => onToJournal(n.id)} />
            <TouchableOpacity onPress={() => onRemove(n.id)} hitSlop={10} accessibilityLabel="Drop this note">
              <Text style={styles.drop}>✕</Text>
            </TouchableOpacity>
          </View>
        )
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: 16, padding: 12, borderRadius: 14, backgroundColor: colors.warnSoft },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 13, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', color: colors.warn },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  input: { flex: 1, paddingVertical: 8, backgroundColor: colors.bg },
  empty: { fontSize: 13, color: colors.muted, marginTop: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 10 },
  body: { flex: 1 },
  text: { fontSize: 15, color: colors.ink },
  meta: { fontSize: 11, color: colors.muted, marginTop: 1 },
  drop: { color: colors.muted, fontSize: 16, paddingHorizontal: 6 },
});
