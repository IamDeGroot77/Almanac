import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';
import { streaks, evaluateAchievements } from '../achievements';

// Streaks that forgive, and badges that only add up.
export default function AchievementsSection({ store }) {
  const now = Date.now();
  const runs = streaks(store, now).filter((s) => s.run > 0 || s.best > 0);
  const all = evaluateAchievements(store, now);
  const earned = all.filter((a) => a.earnedAt || a.complete).sort((a, b) => (b.earnedAt || 0) - (a.earnedAt || 0));
  const next = all.filter((a) => !a.earnedAt && !a.complete).sort((a, b) => b.done / b.target - a.done / a.target).slice(0, 4);

  return (
    <View>
      <Text style={styles.label}>Runs</Text>
      {runs.length === 0 ? <Text style={styles.muted}>Runs start counting from tomorrow. One missed day in seven is forgiven, and a skip token never breaks one.</Text> : null}
      <View style={styles.grid}>
        {runs.map((s) => (
          <View key={s.id} style={styles.run}>
            <Text style={styles.runNum}>{s.run}</Text>
            <Text style={styles.runName}>{s.name}</Text>
            <Text style={styles.runBest}>{s.run >= s.best ? 'your best' : `best ${s.best}`}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.label}>Earned</Text>
      {earned.length === 0 ? <Text style={styles.muted}>Nothing yet. The first ones are close.</Text> : null}
      <View style={styles.badges}>
        {earned.map((a) => (
          <View key={a.id} style={styles.badge}>
            <Text style={styles.badgeName}>★ {a.name}</Text>
            <Text style={styles.badgeBlurb}>{a.blurb}</Text>
          </View>
        ))}
      </View>

      {next.length ? (
        <View>
          <Text style={styles.label}>Next up</Text>
          {next.map((a) => (
            <View key={a.id} style={styles.nextRow}>
              <View style={styles.nextBody}>
                <Text style={styles.nextName}>{a.name}</Text>
                <Text style={styles.badgeBlurb}>{a.blurb}</Text>
              </View>
              <Text style={styles.nextProgress}>
                {a.done}/{a.target}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 13, fontWeight: '600', color: colors.muted, marginTop: 12, marginBottom: 6 },
  muted: { fontSize: 14, color: colors.muted },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  run: { minWidth: 96, padding: 10, borderRadius: 12, backgroundColor: colors.accentSoft },
  runNum: { fontSize: 24, fontWeight: '800', color: colors.accent },
  runName: { fontSize: 13, color: colors.ink, marginTop: 2 },
  runBest: { fontSize: 11, color: colors.muted },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  badge: { padding: 10, borderRadius: 12, borderWidth: 1, borderColor: colors.line, maxWidth: 220 },
  badgeName: { fontSize: 14, fontWeight: '700', color: colors.ink },
  badgeBlurb: { fontSize: 12, color: colors.muted, marginTop: 2 },
  nextRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  nextBody: { flex: 1 },
  nextName: { fontSize: 14, color: colors.ink },
  nextProgress: { fontSize: 13, fontWeight: '700', color: colors.accent, marginLeft: 10 },
});
