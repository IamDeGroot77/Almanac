import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { colors, shared } from '../theme';
import { PrimaryButton, SmallButton } from './Buttons';

// The one box. Say a thing; it goes where it belongs. Shows what was filed,
// with Undo, and the assistant's short reply when it had one.
export default function AskCard({ assistant, autoFocus = false, onOpenSettings }) {
  const [text, setText] = useState('');
  const inputRef = useRef(null);
  const { hasKey, busy, last, ask, clearLast } = assistant;

  useEffect(() => {
    if (autoFocus) setTimeout(() => inputRef.current?.focus(), 250);
  }, [autoFocus]);

  const send = async () => {
    const line = text.trim();
    if (!line || busy) return;
    setText('');
    await ask(line);
  };

  return (
    <View style={[shared.card, styles.card]}>
      <Text style={styles.kicker}>Tell Almanac</Text>
      <View style={styles.row}>
        <TextInput
          ref={inputRef}
          style={[shared.input, styles.input]}
          value={text}
          onChangeText={setText}
          placeholder={hasKey === false ? 'Add a task, hold a thought…' : 'A task, a thought, a note, "what\'s on today?"…'}
          placeholderTextColor={colors.muted}
          multiline
          blurOnSubmit
          returnKeyType="send"
          onSubmitEditing={send}
          editable={!busy}
          accessibilityLabel="Tell Almanac"
        />
        {busy ? <ActivityIndicator color={colors.accent} style={styles.spinner} /> : <PrimaryButton label="Go" onPress={send} />}
      </View>
      {hasKey === false ? (
        <TouchableOpacity onPress={onOpenSettings} accessibilityRole="button">
          <Text style={styles.hint}>No assistant key yet. Lines still file the plain way. Add a key in Settings › Assistant ›</Text>
        </TouchableOpacity>
      ) : null}
      {last ? (
        <View style={styles.result}>
          {last.lines.map((l, i) => (
            <Text key={i} style={styles.line}>
              {l}
            </Text>
          ))}
          {last.errors.map((e, i) => (
            <Text key={`e${i}`} style={styles.error}>
              {e}
            </Text>
          ))}
          {last.text ? <Text style={[styles.reply, last.fallback && styles.replyMuted]}>{last.text}</Text> : null}
          <View style={styles.actions}>
            {last.undo ? <SmallButton label="Undo" onPress={() => { last.undo(); clearLast(); }} /> : null}
            <SmallButton label="OK" onPress={clearLast} />
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: 16 },
  kicker: { fontSize: 12, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', color: colors.accent, marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  input: { flex: 1, minHeight: 44, maxHeight: 120 },
  spinner: { width: 64, height: 44 },
  hint: { fontSize: 12, color: colors.muted, marginTop: 8 },
  result: { marginTop: 12, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  line: { fontSize: 14, color: colors.ink, marginTop: 2 },
  error: { fontSize: 13, color: colors.warn, marginTop: 4 },
  reply: { fontSize: 14, color: colors.ink, marginTop: 8, fontStyle: 'italic' },
  replyMuted: { color: colors.muted, fontStyle: 'normal', fontSize: 12 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 10 },
});
