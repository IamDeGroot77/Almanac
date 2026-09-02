import { useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { colors, shared } from '../theme';
import { SmallButton } from './Buttons';
import PersonChips from './PersonChips';
import { newId } from '../ids';

// Settings: rules that turn finished calendar events into tasks.
export default function CalendarRulesSection({ rules, lists, onChange }) {
  const [keyword, setKeyword] = useState('');
  const [listId, setListId] = useState(lists[0]?.id || null);
  const [template, setTemplate] = useState('Write article: {title}');
  const [dueDays, setDueDays] = useState('1');
  const listName = (id) => lists.find((l) => l.id === id)?.name || 'a deleted list';

  const add = () => {
    const kw = keyword.trim();
    if (!kw || !listId) return;
    onChange([...(rules || []), { id: newId('cr'), keyword: kw, listId, template: template.trim() || '{title}', dueDays: Number(dueDays) || 1 }]);
    setKeyword('');
  };
  const remove = (id) => onChange((rules || []).filter((r) => r.id !== id));

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Calendar rules</Text>
      <Text style={shared.muted}>
        When an event whose title contains a keyword has finished, Almanac makes a task from it. "city meeting" can
        become "Write article: City council meeting" on Reporter, due the next day. Checked each time the app opens.
      </Text>
      {(rules || []).map((r) => (
        <View key={r.id} style={[styles.rule, shared.hairline]}>
          <View style={styles.ruleBody}>
            <Text style={styles.ruleText}>
              "{r.keyword}" → {listName(r.listId)}
            </Text>
            <Text style={styles.ruleMeta}>
              {r.template} · due {r.dueDays} {r.dueDays === 1 ? 'day' : 'days'} after
            </Text>
          </View>
          <TouchableOpacity onPress={() => remove(r.id)} hitSlop={10} accessibilityLabel="Remove rule">
            <Text style={styles.remove}>✕</Text>
          </TouchableOpacity>
        </View>
      ))}
      {lists.length === 0 ? (
        <Text style={shared.muted}>Create a named list first.</Text>
      ) : (
        <View style={styles.form}>
          <TextInput style={shared.input} value={keyword} onChangeText={setKeyword} placeholder="Keyword in the event title, e.g. city meeting" placeholderTextColor={colors.muted} autoCapitalize="none" />
          <Text style={styles.label}>Task goes to</Text>
          <PersonChips people={lists.map((l) => ({ id: l.id, name: l.name }))} selected={listId} onSelect={setListId} compact />
          <Text style={styles.label}>Task text ({'{title}'} and {'{date}'} fill in)</Text>
          <TextInput style={shared.input} value={template} onChangeText={setTemplate} placeholder="Write article: {title}" placeholderTextColor={colors.muted} />
          <Text style={styles.label}>Due, days after the event</Text>
          <PersonChips
            people={[
              { id: '0', name: 'Same day' },
              { id: '1', name: '1' },
              { id: '2', name: '2' },
              { id: '3', name: '3' },
              { id: '7', name: '7' },
            ]}
            selected={dueDays}
            onSelect={setDueDays}
            compact
          />
          <SmallButton label="Add rule" onPress={add} style={styles.add} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 28 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.muted, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 6 },
  rule: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  ruleBody: { flex: 1 },
  ruleText: { fontSize: 15, color: colors.ink },
  ruleMeta: { fontSize: 12, color: colors.muted, marginTop: 2 },
  remove: { color: colors.muted, fontSize: 16, paddingHorizontal: 8 },
  form: { marginTop: 12, gap: 8 },
  label: { fontSize: 13, fontWeight: '600', color: colors.muted, marginTop: 4 },
  add: { alignSelf: 'flex-start', marginTop: 6 },
});
