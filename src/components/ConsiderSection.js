import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';
import { SmallButton } from './Buttons';
import { describeConsideration } from '../consider';

// "Worth considering": tasks from the timeline lists that have waited a
// while. Two answers, no guilt.
export default function ConsiderSection({ items, onToday, onLater }) {
  if (!items?.length) return null;
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Worth considering</Text>
      <Text style={styles.hint}>These have been waiting on a timeline list. Do one today, or let it wait.</Text>
      {items.map((c) => (
        <View key={c.task.id} style={styles.row}>
          <View style={styles.body}>
            <Text style={styles.text}>{c.task.text}</Text>
            <Text style={styles.meta}>{describeConsideration(c)}</Text>
          </View>
          <SmallButton label="Today" onPress={() => onToday(c.task.id)} />
          <SmallButton label="Not yet" onPress={() => onLater(c.task.id)} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 24, padding: 14, borderRadius: 12, backgroundColor: colors.warnSoft },
  title: { fontSize: 16, fontWeight: '700', color: colors.ink },
  hint: { fontSize: 12, color: colors.muted, marginTop: 2, marginBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
  body: { flex: 1 },
  text: { fontSize: 15, color: colors.ink },
  meta: { fontSize: 12, color: colors.muted, marginTop: 2 },
});
