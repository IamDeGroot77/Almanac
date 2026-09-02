import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { colors, shared } from '../theme';
import { PrimaryButton } from './Buttons';

// Dialog for naming a new standing list. Keeps list creation visually
// separate from adding a task to a day.
export default function NewListModal({ visible, onCreate, onClose }) {
  const [name, setName] = useState('');

  useEffect(() => {
    if (visible) setName('');
  }, [visible]);

  const submit = () => {
    if (!name.trim()) return;
    onCreate(name);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.backdropWrap}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close">
          <Pressable style={styles.card} onPress={() => {}}>
            <Text style={styles.title}>New list</Text>
            <Text style={styles.hint}>
              A named list for things that aren't tied to a day, like Groceries or Home.
              It syncs with Google Tasks when you're connected.
            </Text>
            <TextInput
              style={[shared.input, styles.input]}
              value={name}
              onChangeText={setName}
              placeholder="List name"
              placeholderTextColor={colors.muted}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={submit}
            />
            <View style={styles.actions}>
              <TouchableOpacity onPress={onClose} style={styles.cancel} accessibilityRole="button">
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <PrimaryButton label="Create list" onPress={submit} />
            </View>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdropWrap: { flex: 1 },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    padding: 24,
  },
  card: { backgroundColor: colors.bg, borderRadius: 16, padding: 20 },
  title: { fontSize: 20, fontWeight: '700', color: colors.ink },
  hint: { fontSize: 14, color: colors.muted, marginTop: 6, marginBottom: 14 },
  input: { flex: 0 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', marginTop: 16, gap: 12 },
  cancel: { paddingHorizontal: 8, paddingVertical: 10 },
  cancelText: { color: colors.muted, fontWeight: '600', fontSize: 15 },
});
