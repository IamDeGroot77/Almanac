import { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors } from '../theme';
import { SmallButton } from './Buttons';

// "Why am I stuck?" Three taps from a stuck feeling to a choice with a
// default. The reason is remembered so patterns show up later.
export const STUCK_REASONS = [
  { id: 'energy', label: 'No energy', hint: 'Shrink it or move it.' },
  { id: 'clarity', label: 'Not clear', hint: 'The next step is fuzzy.' },
  { id: 'dread', label: 'Dread', hint: "It's the feeling, not the size." },
  { id: 'place', label: 'Wrong place or time', hint: 'Decide when and where.' },
];

export default function StuckSection({ task, onStuck, actions }) {
  const [reason, setReason] = useState(task?.stuck?.reason || null);
  const pick = (id) => {
    setReason(id);
    onStuck?.(task.id, id);
  };
  const dodged = task?.carriedCount || 0;
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Why am I stuck?</Text>
      <Text style={styles.hint}>
        {dodged >= 2 ? `Dodged ${dodged} days. ` : ''}Name it and the app offers a way out. No judgement, just a default.
      </Text>
      <View style={styles.chips}>
        {STUCK_REASONS.map((r) => (
          <TouchableOpacity key={r.id} style={[styles.chip, reason === r.id && styles.chipOn]} onPress={() => pick(r.id)} accessibilityRole="button" accessibilityState={{ selected: reason === r.id }}>
            <Text style={[styles.chipText, reason === r.id && styles.chipTextOn]}>{r.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {reason ? (
        <View style={styles.actions}>
          <Text style={styles.reasonHint}>{STUCK_REASONS.find((r) => r.id === reason)?.hint}</Text>
          <View style={styles.row}>
            {reason === 'energy' ? (
              <>
                <SmallButton label="Just the first step" onPress={actions.startFirstStep} />
                <SmallButton label="Higher-energy day" onPress={actions.moveTomorrow} />
              </>
            ) : null}
            {reason === 'clarity' ? (
              <>
                <SmallButton label="Break it down" onPress={actions.breakDown} />
                <SmallButton label="Write the first step" onPress={actions.focusFirstStep} />
              </>
            ) : null}
            {reason === 'dread' ? (
              <>
                <SmallButton label="Two minutes, then stop" onPress={actions.startFirstStep} />
                <SmallButton label="Talk it out in the journal" onPress={actions.journal} />
              </>
            ) : null}
            {reason === 'place' ? (
              <>
                <SmallButton label="Set when and where" onPress={actions.focusPlan} />
                <SmallButton label="Put it in a block" onPress={actions.moveTomorrow} />
              </>
            ) : null}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 22, padding: 12, borderRadius: 14, backgroundColor: colors.warnSoft },
  title: { fontSize: 15, fontWeight: '700', color: colors.ink },
  hint: { fontSize: 12, color: colors.muted, marginTop: 2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  chip: { borderWidth: 1, borderColor: colors.line, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: colors.bg },
  chipOn: { backgroundColor: colors.warn, borderColor: colors.warn },
  chipText: { fontSize: 13, fontWeight: '600', color: colors.ink },
  chipTextOn: { color: colors.onAccent },
  actions: { marginTop: 10 },
  reasonHint: { fontSize: 13, color: colors.muted, marginBottom: 6 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
