import { StyleSheet, Text, View } from 'react-native';
import { colors, shared } from '../theme';

// "Am I using this?" — the app's own reality check, one row per week.
export default function UsageTable({ weeks }) {
  if (!weeks || weeks.every((w) => w.opened === 0 && w.captured === 0)) {
    return <Text style={shared.muted}>Nothing to show yet. After a week this tells you honestly whether Almanac is earning its place.</Text>;
  }
  return (
    <View>
      <View style={[styles.row, styles.head]}>
        <Text style={[styles.cell, styles.label]}>Week</Text>
        <Text style={styles.cell}>Opened</Text>
        <Text style={styles.cell}>Bracketed</Text>
        <Text style={styles.cell}>Added</Text>
        <Text style={styles.cell}>Started</Text>
        <Text style={styles.cell}>Finished</Text>
      </View>
      {weeks.map((w) => (
        <View key={w.key} style={[styles.row, shared.hairline]}>
          <Text style={[styles.cell, styles.label]}>{w.label}</Text>
          <Text style={[styles.cell, w.opened === 0 && styles.zero]}>{w.opened}/7</Text>
          <Text style={[styles.cell, w.bracketed === 0 && styles.zero]}>{w.bracketed}/7</Text>
          <Text style={styles.cell}>{w.captured}</Text>
          <Text style={styles.cell}>{w.started}</Text>
          <Text style={styles.cell}>{w.finished}</Text>
        </View>
      ))}
      <Text style={styles.note}>
        Opened counts days this device opened Almanac. Bracketed counts days with a real "I'm up" tap, not a guessed one.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', paddingVertical: 8, alignItems: 'center' },
  head: { borderBottomWidth: 1, borderBottomColor: colors.line },
  cell: { flex: 1, fontSize: 13, color: colors.ink, textAlign: 'center' },
  label: { flex: 1.4, textAlign: 'left', color: colors.muted },
  zero: { color: colors.danger, fontWeight: '700' },
  note: { fontSize: 12, color: colors.muted, marginTop: 8 },
});
