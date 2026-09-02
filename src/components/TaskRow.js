import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, shared } from '../theme';

export default function TaskRow({ task, onToggle, onDelete, onLongPress }) {
  return (
    <View style={[styles.row, shared.hairline]}>
      <TouchableOpacity
        style={styles.main}
        onPress={() => onToggle(task.id)}
        onLongPress={() => onLongPress(task)}
        delayLongPress={350}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: task.done }}
        accessibilityHint="Long press to move this task"
      >
        <Text style={[styles.checkbox, task.done && styles.checkboxDone]}>
          {task.done ? '✓' : ''}
        </Text>
        <Text style={[styles.text, task.done && styles.textDone]}>{task.text}</Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => onDelete(task.id)}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel={`Delete ${task.text}`}
      >
        <Text style={styles.delete}>✕</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  main: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.accent,
    textAlign: 'center',
    lineHeight: 20,
    fontSize: 14,
    color: '#FFFFFF',
    marginRight: 12,
  },
  checkboxDone: { backgroundColor: colors.accent },
  text: { fontSize: 16, color: colors.ink, flex: 1 },
  textDone: { textDecorationLine: 'line-through', color: colors.muted },
  delete: { color: colors.muted, fontSize: 16, paddingHorizontal: 8 },
});
