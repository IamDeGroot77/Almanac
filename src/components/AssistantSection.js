import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, shared } from '../theme';
import { PrimaryButton, SmallButton } from './Buttons';
import PersonChips from './PersonChips';
import { testKey, MODELS } from '../assistant/client';

// Settings: the Anthropic API key (typed here, kept in the device keystore),
// which model answers, and a plain account of what gets sent.
export default function AssistantSection({ assistant, model, onSetModel }) {
  const [draft, setDraft] = useState('');
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    const k = draft.trim();
    if (!k) return;
    setBusy(true);
    setStatus('Checking the key…');
    try {
      await testKey(k);
      await assistant.saveKey(k);
      setDraft('');
      setStatus('Key works and is saved.');
    } catch (err) {
      setStatus(err?.message || 'The key did not work.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    await assistant.saveKey('');
    setStatus('Key removed. Lines file the plain way now.');
  };

  return (
    <View>
      <Text style={shared.muted}>
        Tell Almanac one line and Claude files it: a task on the right list, a thought in working memory, a feeling in the journal, minutes on a routine. Needs an Anthropic API key from console.anthropic.com with a little prepaid credit; a day of use costs cents. The Claude subscription does not cover this.
      </Text>
      <Text style={styles.label}>{assistant.hasKey ? 'Key saved on this device' : 'API key'}</Text>
      <View style={styles.row}>
        <TextInput
          style={[shared.input, styles.input]}
          value={draft}
          onChangeText={setDraft}
          placeholder={assistant.hasKey ? 'Paste a new key to replace it' : 'sk-ant-…'}
          placeholderTextColor={colors.muted}
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry
        />
        <PrimaryButton label={busy ? '…' : 'Save'} onPress={save} disabled={busy || !draft.trim()} />
      </View>
      {assistant.hasKey ? <SmallButton label="Remove key" onPress={remove} style={styles.remove} /> : null}
      {status ? <Text style={styles.status}>{status}</Text> : null}

      <Text style={styles.label}>Model</Text>
      <PersonChips people={Object.entries(MODELS).map(([id, m]) => ({ id, name: m.name }))} selected={model} onSelect={onSetModel} compact />
      <Text style={shared.muted}>Quick is fast and cheap and right nearly always. Careful thinks longer; use it if Quick keeps filing things wrong.</Text>

      <Text style={styles.label}>What gets sent</Text>
      <Text style={shared.muted}>
        Your line, plus a snapshot: list names, categories, people, routine names, this week's tasks, and what is in working memory. Never the journal, never sync tokens. Nothing is sent unless you use the box. Anthropic does not train on API traffic.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 13, fontWeight: '600', color: colors.muted, marginTop: 14, marginBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  input: { flex: 1 },
  remove: { alignSelf: 'flex-start', marginTop: 8 },
  status: { fontSize: 13, color: colors.ink, marginTop: 8 },
});
