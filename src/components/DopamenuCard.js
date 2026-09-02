import { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors } from '../theme';

// Low energy: instead of the list, two small good things. A "dopamine
// menu" is a list you wrote when you were fine, for when you're not.
// kind: 'appetizer' (2 minutes), 'side' (pair with a boring task), 'dessert' (scroll risk, keep it short)
export default function DopamenuCard({ menu, onDid }) {
  const [done, setDone] = useState([]);
  const items = (menu || []).filter((m) => m.kind !== 'dessert');
  if (items.length === 0) return null;
  // Rotate through the menu by day so the same two don't always show.
  const seed = new Date().getDate();
  const pick = [...items].sort((a, b) => ((a.id.charCodeAt(0) + seed) % 7) - ((b.id.charCodeAt(0) + seed) % 7)).slice(0, 3);
  return (
    <View style={styles.card}>
      <Text style={styles.kicker}>Low energy · start small</Text>
      <Text style={styles.hint}>Nothing on the list yet. One of these first, then see.</Text>
      {pick.map((m) => (
        <TouchableOpacity
          key={m.id}
          style={styles.row}
          onPress={() => {
            setDone([...done, m.id]);
            onDid?.(m);
          }}
          accessibilityRole="button"
        >
          <View style={[styles.box, done.includes(m.id) && styles.boxDone]}>{done.includes(m.id) ? <Text style={styles.check}>✓</Text> : null}</View>
          <Text style={[styles.text, done.includes(m.id) && styles.textDone]}>{m.text}</Text>
          <Text style={styles.kind}>{m.kind === 'side' ? 'pair with a task' : '2 min'}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: 16, padding: 14, borderRadius: 14, backgroundColor: colors.accentSoft },
  kicker: { fontSize: 12, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', color: colors.accent },
  hint: { fontSize: 13, color: colors.muted, marginTop: 2, marginBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 10 },
  box: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  boxDone: { backgroundColor: colors.accent },
  check: { color: colors.onAccent, fontSize: 13, fontWeight: '700' },
  text: { flex: 1, fontSize: 15, color: colors.ink },
  textDone: { color: colors.muted, textDecorationLine: 'line-through' },
  kind: { fontSize: 11, color: colors.muted },
});
