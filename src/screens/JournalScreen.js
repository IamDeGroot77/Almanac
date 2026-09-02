import { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { colors, shared } from '../theme';
import Screen from '../components/Screen';
import { PrimaryButton, SmallButton } from '../components/Buttons';
import { journalDays, promptForDay, SKIP_PROMPT } from '../journal';
import { almanacToday } from '../clock';
import { describeDayKey, formatTime } from '../dates';
import { isWeb } from '../platform';

// The journal: a page per almanac day, short entries with the time, a
// rotating prompt for when the page is blank, and everything searchable.
// Spoken notes from the watch land here too.
export default function JournalScreen({ journal, dayNotes, onAdd, onEdit, onDelete, initialPrompt = null, onPromptUsed }) {
  const today = almanacToday();
  const [text, setText] = useState('');
  const [prompt, setPrompt] = useState(initialPrompt);
  useEffect(() => {
    if (initialPrompt) {
      setPrompt(initialPrompt);
      onPromptUsed?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPrompt]);
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState(null); // { id, key, text }
  const dailyPrompt = promptForDay(today);
  const days = journalDays(journal, { query, limit: query ? 200 : 45 });
  const todayEntries = days.find((d) => d.key === today)?.entries || [];

  const save = () => {
    const t = text.trim();
    if (!t) return;
    onAdd(t, { prompt: prompt || null, source: prompt ? 'prompt' : 'typed' });
    setText('');
    setPrompt(null);
  };

  return (
    <Screen>
      <Text style={styles.title}>Journal</Text>
      <Text style={shared.muted}>{describeDayKey(today)}</Text>

      <View style={[styles.page, isWeb && styles.pageWide]}>
        {prompt ? (
          <View style={styles.promptRow}>
            <Text style={styles.promptText}>{prompt}</Text>
            <SmallButton label="✕" onPress={() => setPrompt(null)} />
          </View>
        ) : null}
        <TextInput
          style={[shared.input, styles.box]}
          multiline
          value={text}
          onChangeText={setText}
          placeholder={prompt ? 'Write it down…' : "What's on your mind?"}
          placeholderTextColor={colors.muted}
        />
        <View style={styles.row}>
          <PrimaryButton label="Save" onPress={save} />
          {!prompt ? <SmallButton label={dailyPrompt} onPress={() => setPrompt(dailyPrompt)} /> : null}
        </View>
        {!prompt ? (
          <View style={styles.chips}>
            {dailyPrompt !== 'What got in the way?' ? <SmallButton label="What got in the way?" onPress={() => setPrompt('What got in the way?')} /> : null}
            <SmallButton label={SKIP_PROMPT} onPress={() => setPrompt(SKIP_PROMPT)} />
          </View>
        ) : null}
        {todayEntries.length === 0 && !dayNotes?.[today] ? <Text style={styles.empty}>Nothing written today yet. A sentence counts.</Text> : null}
        {todayEntries.map((e) => (
          <Entry key={e.id} entry={e} dayKey={today} editing={editing} setEditing={setEditing} onEdit={onEdit} onDelete={onDelete} />
        ))}
        {dayNotes?.[today] ? <Text style={styles.dayNote}>Day note: {dayNotes[today]}</Text> : null}
      </View>

      <TextInput style={[shared.input, styles.search]} value={query} onChangeText={setQuery} placeholder="Search the journal" placeholderTextColor={colors.muted} autoCapitalize="none" />

      {days
        .filter((d) => d.key !== today || query)
        .map((d) => (
          <View key={d.key} style={styles.day}>
            <Text style={styles.dayTitle}>{describeDayKey(d.key)}</Text>
            {d.entries.map((e) => (
              <Entry key={e.id} entry={e} dayKey={d.key} editing={editing} setEditing={setEditing} onEdit={onEdit} onDelete={onDelete} />
            ))}
            {dayNotes?.[d.key] && !query ? <Text style={styles.dayNote}>Day note: {dayNotes[d.key]}</Text> : null}
          </View>
        ))}
      {days.length === 0 && query ? <Text style={shared.muted}>Nothing matches.</Text> : null}
    </Screen>
  );
}

function Entry({ entry, dayKey, editing, setEditing, onEdit, onDelete }) {
  const isEditing = editing?.id === entry.id;
  if (isEditing) {
    return (
      <View style={styles.entry}>
        <TextInput style={[shared.input, styles.box]} multiline value={editing.text} onChangeText={(t) => setEditing({ ...editing, text: t })} autoFocus />
        <View style={styles.row}>
          <SmallButton
            label="Save"
            onPress={() => {
              onEdit(dayKey, entry.id, editing.text);
              setEditing(null);
            }}
          />
          <SmallButton label="Delete" onPress={() => { onDelete(dayKey, entry.id); setEditing(null); }} />
          <SmallButton label="Cancel" onPress={() => setEditing(null)} />
        </View>
      </View>
    );
  }
  return (
    <TouchableOpacity style={styles.entry} onLongPress={() => setEditing({ id: entry.id, key: dayKey, text: entry.text })} delayLongPress={350} onPress={isWeb ? () => setEditing({ id: entry.id, key: dayKey, text: entry.text }) : undefined} accessibilityRole="button" accessibilityHint="Long press to edit">
      <Text style={styles.entryMeta}>
        {formatTime(entry.at)}
        {entry.source === 'voice' ? ' · spoken' : entry.source === 'letter' ? ' · from the Sunday letter' : entry.source === 'scratch' ? ' · from working memory' : ''}
        {entry.prompt ? ` · ${entry.prompt}` : ''}
      </Text>
      <Text style={styles.entryText}>{entry.text}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 26, fontWeight: '700', color: colors.ink },
  page: { marginTop: 14, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.bg },
  pageWide: { maxWidth: 760 },
  box: { minHeight: 90, textAlignVertical: 'top', fontSize: 16, lineHeight: 22 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10, flexWrap: 'wrap' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  promptRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, gap: 8 },
  promptText: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.accent },
  empty: { fontSize: 13, color: colors.muted, marginTop: 14 },
  entry: { paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line, marginTop: 8 },
  entryMeta: { fontSize: 12, color: colors.muted, marginBottom: 3 },
  entryText: { fontSize: 15, color: colors.ink, lineHeight: 21 },
  dayNote: { fontSize: 14, color: colors.muted, fontStyle: 'italic', marginTop: 10 },
  search: { marginTop: 24 },
  day: { marginTop: 22 },
  dayTitle: { fontSize: 16, fontWeight: '700', color: colors.ink },
});
