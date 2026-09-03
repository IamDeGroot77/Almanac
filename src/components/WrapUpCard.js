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
  onCarry,
  onNextWeek,
  onDrop,
  doneTasks = [],
  openTasks = [],
  tomorrowOptions = [],
  oneThing = null,
  onPickOneThing,
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

      {doneTasks.length > 0 ? (
        <View style={styles.haveDone}>
          <Text style={styles.label}>Have done</Text>
          {doneTasks.map((t) => (
            <Text key={t.id} style={styles.doneLine}>
              ✓ {t.text}
              {t.durationMs ? <Text style={styles.doneMeta}>  {formatDuration(t.durationMs)}</Text> : null}
            </Text>
          ))}
        </View>
      ) : null}

      {openTasks.length > 0 && onCarry ? (
        <View style={styles.leftovers}>
          <Text style={styles.label}>Still open · decide each one</Text>
          {openTasks.map((t) => (
            <View key={t.id} style={styles.leftoverRow}>
              <View style={styles.leftoverBody}>
                <Text style={styles.leftoverText}>{t.text}</Text>
                {t.carriedCount >= 2 ? <Text style={styles.leftoverMeta}>carried {t.carriedCount >= 4 ? '3+' : t.carriedCount} days</Text> : null}
              </View>
              <SmallButton label="Tomorrow" onPress={() => onCarry(t.id)} />
              <SmallButton label="Next week" onPress={() => onNextWeek(t.id)} />
              <SmallButton label="Drop" onPress={() => onDrop(t.id)} />
            </View>
          ))}
        </View>
      ) : null}

      {onPickOneThing && tomorrowOptions.length > 0 ? (
        <View style={styles.leftovers}>
          <Text style={styles.label}>Tomorrow starts with</Text>
          <View style={styles.chips}>
            {tomorrowOptions.slice(0, 6).map((t) => (
              <SmallButton key={t.id} label={oneThing === t.id ? `★ ${t.text}` : t.text} onPress={() => onPickOneThing(oneThing === t.id ? null : t.id)} />
            ))}
          </View>
          <Text style={styles.doneMeta}>One thing. It leads the brief, Home, and the widget in the morning.</Text>
        </View>
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
          <PrimaryButton label="Going to bed" onPress={onGoodNight} style={styles.push} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: 24, padding: 16, borderRadius: 14, backgroundColor: colors.accentSoft },
  kicker: { fontSize: 12, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', color: colors.accent },
  title: { fontSize: 17, fontWeight: '700', color: colors.ink, marginTop: 4 },
  sub: { fontSize: 14, color: colors.muted, marginTop: 2 },
  routines: { marginTop: 10 },
  haveDone: { marginTop: 4 },
  doneLine: { fontSize: 14, color: colors.ink, marginTop: 3 },
  doneMeta: { fontSize: 12, color: colors.muted },
  leftovers: { marginTop: 4 },
  leftoverRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6 },
  leftoverBody: { flex: 1 },
  leftoverText: { fontSize: 14, color: colors.ink },
  leftoverMeta: { fontSize: 11, color: colors.warn },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  routine: { fontSize: 14, color: colors.ink, marginTop: 2 },
  routineDone: { color: colors.muted },
  label: { fontSize: 13, fontWeight: '600', color: colors.muted, marginTop: 14, marginBottom: 6 },
  note: { flex: 0, minHeight: 60, textAlignVertical: 'top', backgroundColor: colors.bg },
  actions: { marginTop: 14, gap: 12 },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  push: { flex: 1 },
  clear: { fontSize: 14, color: colors.muted },
});
