import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { colors, shared } from '../theme';
import { PrimaryButton, SmallButton } from './Buttons';
import { formatDuration } from '../durations';
import EnergyPrompt from './EnergyPrompt';

// End-of-day: what happened, a note for the record, and what to do with
// anything left over.
export default function WrapUpCard({
  doneCount,
  openCount,
  trackedMs,
  estimateMs,
  routines, // [{ name, done, target, complete }]
  note,
  onChangeNote,
  onPushToTomorrow,
  onGoodNight,
  onClose,
  energy,
  onEnergy,
}) {
  return (
    <View style={styles.card}>
      <Text style={styles.kicker}>End of day</Text>
      <Text style={styles.title}>
        {doneCount === 0
          ? 'Nothing finished yet today.'
          : `${doneCount} finished${trackedMs ? `, ${formatDuration(trackedMs)} tracked` : ''}.`}
      </Text>
      {estimateMs > 0 && trackedMs > 0 ? (
        <Text style={styles.sub}>
          Estimated {formatDuration(estimateMs)}, took {formatDuration(trackedMs)}.
        </Text>
      ) : null}

      {routines.length > 0 && (
        <View style={styles.routines}>
          {routines.map((r) => (
            <Text key={r.name} style={[styles.routine, r.complete && styles.routineDone]}>
              {r.complete ? '✓' : '○'} {r.name}: {r.done}/{r.target}
            </Text>
          ))}
        </View>
      )}

      {onEnergy ? (
        <EnergyPrompt question="Energy at the end of the day?" value={energy?.bed ?? null} onSelect={(v) => onEnergy('bed', v)} />
      ) : null}

      <Text style={styles.label}>A line for the record</Text>
      <TextInput
        style={[shared.input, styles.note]}
        value={note}
        onChangeText={onChangeNote}
        placeholder="How did today go?"
        placeholderTextColor={colors.muted}
        multiline
      />

      <View style={styles.actions}>
        {openCount > 0 ? (
          <SmallButton label={`Push ${openCount} unfinished to tomorrow`} onPress={onPushToTomorrow} />
        ) : (
          <Text style={styles.clear}>Nothing left over. Clean slate for tomorrow.</Text>
        )}
        <View style={styles.actionRow}>
          <SmallButton label="Not yet" onPress={onClose} />
          <PrimaryButton label="Good night" onPress={onGoodNight} style={styles.push} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: 24, padding: 16, borderRadius: 12, backgroundColor: colors.accentSoft },
  kicker: { fontSize: 12, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', color: colors.accent },
  title: { fontSize: 17, fontWeight: '700', color: colors.ink, marginTop: 4 },
  sub: { fontSize: 14, color: colors.muted, marginTop: 2 },
  routines: { marginTop: 10 },
  routine: { fontSize: 14, color: colors.ink, marginTop: 2 },
  routineDone: { color: colors.muted },
  label: { fontSize: 13, fontWeight: '600', color: colors.muted, marginTop: 14, marginBottom: 6 },
  note: { flex: 0, minHeight: 60, textAlignVertical: 'top', backgroundColor: colors.bg },
  actions: { marginTop: 14, gap: 12 },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  push: { flex: 1 },
  clear: { fontSize: 14, color: colors.muted },
});
