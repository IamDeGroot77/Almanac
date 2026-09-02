import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors } from '../theme';

// A short-lived bar above the tab bar: "Deleted Essay 1 · Undo".
export default function UndoBar({ undo }) {
  if (!undo) return null;
  return (
    <View style={styles.bar}>
      <Text style={styles.text} numberOfLines={1}>
        {undo.label}
      </Text>
      <TouchableOpacity onPress={undo.onUndo} hitSlop={10} accessibilityRole="button">
        <Text style={styles.action}>Undo</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 76,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.ink,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  text: { color: '#FFFFFF', fontSize: 14, flex: 1, marginRight: 12 },
  action: { color: colors.accentSoft, fontWeight: '700', fontSize: 14 },
});
