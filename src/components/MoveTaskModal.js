import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, shared } from '../theme';
import { dayListIdForOffset } from '../store';

// Bottom sheet listing every place a task can be moved to.
export default function MoveTaskModal({ task, lists, onMove, onClose }) {
  if (!task) return null;

  const destinations = [
    { id: dayListIdForOffset(0), name: 'Today' },
    { id: dayListIdForOffset(1), name: 'Tomorrow' },
    ...lists.map((l) => ({ id: l.id, name: l.name })),
  ].filter((d) => d.id !== task.listId);

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close">
        <Pressable style={styles.sheet} onPress={() => {}}>
          <Text style={styles.title} numberOfLines={2}>
            Move "{task.text}" to…
          </Text>
          {destinations.map((d) => (
            <TouchableOpacity
              key={d.id}
              style={[styles.option, shared.hairline]}
              onPress={() => onMove(task.id, d.id)}
              accessibilityRole="button"
            >
              <Text style={styles.optionText}>{d.name}</Text>
            </TouchableOpacity>
          ))}
          {destinations.length === 0 && (
            <Text style={shared.muted}>No other lists yet. Create one with "+ New list" under Lists.</Text>
          )}
          <TouchableOpacity style={styles.cancel} onPress={onClose} accessibilityRole="button">
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    paddingBottom: 32,
  },
  title: { fontSize: 15, fontWeight: '600', color: colors.muted, marginBottom: 8 },
  option: { paddingVertical: 14 },
  optionText: { fontSize: 17, color: colors.ink },
  cancel: { marginTop: 12, alignItems: 'center', paddingVertical: 10 },
  cancelText: { fontSize: 16, color: colors.accent, fontWeight: '600' },
});
