import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors } from '../theme';

export const ENERGY_LEVELS = [
  { value: 1, label: 'Low' },
  { value: 2, label: 'Okay' },
  { value: 3, label: 'Good' },
];

export const energyLabel = (v) => ENERGY_LEVELS.find((l) => l.value === v)?.label || '';

// One-tap energy check: three chips. `value` selected, or null.
export default function EnergyPrompt({ question, value, onSelect, compact }) {
  return (
    <View style={[styles.row, compact && styles.rowCompact]}>
      <Text style={styles.question}>{question}</Text>
      <View style={styles.chips}>
        {ENERGY_LEVELS.map((l) => {
          const active = value === l.value;
          return (
            <TouchableOpacity
              key={l.value}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => onSelect(l.value)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{l.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { marginTop: 12 },
  rowCompact: { marginTop: 8 },
  question: { fontSize: 13, color: colors.muted, marginBottom: 6 },
  chips: { flexDirection: 'row', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.bg },
  chipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { fontSize: 13, fontWeight: '600', color: colors.ink },
  chipTextActive: { color: colors.onAccent },
});
