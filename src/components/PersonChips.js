import { ScrollView, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { colors } from '../theme';

// Row of selectable people. With `allowAll`, an "All" chip comes first and
// `selected` may be 'all'. With `onAdd`, a "+" chip comes last.
export default function PersonChips({ people, selected, onSelect, allowAll, onAdd, compact }) {
  const chips = allowAll ? [{ id: 'all', name: 'All' }, ...people] : people;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[styles.row, compact && styles.rowCompact]}
      keyboardShouldPersistTaps="handled"
    >
      {chips.map((p) => {
        const active = selected === p.id;
        return (
          <TouchableOpacity
            key={p.id}
            style={[styles.chip, active && styles.chipActive, compact && styles.chipCompact]}
            onPress={() => onSelect(p.id)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
          >
            <Text style={[styles.chipText, active && styles.chipTextActive]}>{p.name}</Text>
          </TouchableOpacity>
        );
      })}
      {onAdd && (
        <TouchableOpacity
          style={[styles.chip, styles.chipAdd, compact && styles.chipCompact]}
          onPress={onAdd}
          accessibilityRole="button"
          accessibilityLabel="Add a person"
        >
          <Text style={styles.chipText}>+</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8, paddingVertical: 2 },
  rowCompact: { paddingVertical: 0 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.bg,
  },
  chipCompact: { paddingHorizontal: 12, paddingVertical: 5 },
  chipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipAdd: { borderStyle: 'dashed' },
  chipText: { fontSize: 14, fontWeight: '600', color: colors.ink },
  chipTextActive: { color: '#FFFFFF' },
});
