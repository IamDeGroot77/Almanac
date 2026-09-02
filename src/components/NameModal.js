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

// Small dialog that asks for one name. Used for new lists and new people.
export default function NameModal({ visible, title, hint, placeholder, submitLabel, onSubmit, onClose }) {
  const [name, setName] = useState('');

  useEffect(() => {
    if (visible) setName('');
  }, [visible]);

  const submit = () => {
    if (!name.trim()) return;
    onSubmit(name);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.wrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close">
          <Pressable style={styles.card} onPress={() => {}}>
            <Text style={styles.title}>{title}</Text>
            {hint ? <Text style={styles.hint}>{hint}</Text> : null}
            <TextInput
              style={[shared.input, styles.input]}
              value={name}
              onChangeText={setName}
              placeholder={placeholder}
              placeholderTextColor={colors.muted}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={submit}
            />
            <View style={styles.actions}>
              <TouchableOpacity onPress={onClose} style={styles.cancel} accessibilityRole="button">
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <PrimaryButton label={submitLabel} onPress={submit} />
            </View>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', padding: 24 },
  card: { backgroundColor: colors.bg, borderRadius: 16, padding: 20 },
  title: { fontSize: 20, fontWeight: '700', color: colors.ink },
  hint: { fontSize: 14, color: colors.muted, marginTop: 6, marginBottom: 14 },
  input: { flex: 0, marginTop: 4 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', marginTop: 16, gap: 12 },
  cancel: { paddingHorizontal: 8, paddingVertical: 10 },
  cancelText: { color: colors.muted, fontWeight: '600', fontSize: 15 },
});
