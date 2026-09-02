import { Alert, Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, shared } from '../theme';
import PersonChips from './PersonChips';
import { personOf } from '../store';
import { HORIZONS, horizonFor } from '../consider';

// Options for a named list: who it's for, rename, delete.
export default function ListOptionsModal({ list, people, categories = [], onSetPerson, onSetHorizon, onSetCategory, onRename, onDelete, onClose }) {
  if (!list) return null;

  const confirmDelete = () =>
    Alert.alert(`Delete "${list.name}"?`, 'Its tasks will be deleted too.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          onDelete(list.id);
          onClose();
        },
      },
    ]);

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close">
        <Pressable style={styles.sheet} onPress={() => {}}>
          <Text style={styles.title} numberOfLines={1}>
            {list.name}
          </Text>

          <Text style={styles.label}>Who is this list for?</Text>
          <PersonChips
            people={people}
            selected={personOf(list)}
            onSelect={(id) => onSetPerson(list.id, id)}
            compact
          />
          <Text style={styles.help}>New tasks added here are tagged for this person.</Text>

          <Text style={styles.label}>Category</Text>
          <PersonChips people={[{ id: 'none', name: 'None' }, ...categories.map((c) => ({ id: c.id, name: c.name }))]} selected={list.categoryId || 'none'} onSelect={(id) => onSetCategory(list.id, id === 'none' ? null : id)} compact />
          <Text style={styles.help}>Day blocks draw tasks from every list in a category. Add categories in Settings.</Text>

          <Text style={styles.label}>Timeline</Text>
          <PersonChips people={HORIZONS.map((h) => ({ id: h.id, name: h.name }))} selected={horizonFor(list).id} onSelect={(id) => onSetHorizon(list.id, HORIZONS.find((h) => h.id === id)?.days || null)} compact />
          <Text style={styles.help}>
            {horizonFor(list).days
              ? `Tasks here are due ${horizonFor(list).name} out, and after ${horizonFor(list).nudgeDays} quiet days each one comes up on Today as worth considering.`
              : 'Give this list a horizon and every task gets a due date that far out, with gentle nudges along the way.'}
          </Text>

          <TouchableOpacity
            style={[styles.option, shared.hairline]}
            onPress={() => {
              onRename(list.id);
              onClose();
            }}
            accessibilityRole="button"
          >
            <Text style={styles.optionText}>Rename</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.option} onPress={confirmDelete} accessibilityRole="button">
            <Text style={[styles.optionText, styles.danger]}>Delete list</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.cancel} onPress={onClose} accessibilityRole="button">
            <Text style={styles.cancelText}>Done</Text>
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
  title: { fontSize: 18, fontWeight: '700', color: colors.ink, marginBottom: 14 },
  label: { fontSize: 13, fontWeight: '600', color: colors.muted, marginBottom: 8 },
  help: { fontSize: 12, color: colors.muted, marginTop: 8, marginBottom: 12 },
  option: { paddingVertical: 14 },
  optionText: { fontSize: 17, color: colors.ink },
  danger: { color: colors.danger },
  cancel: { marginTop: 12, alignItems: 'center', paddingVertical: 10 },
  cancelText: { fontSize: 16, color: colors.accent, fontWeight: '600' },
});
