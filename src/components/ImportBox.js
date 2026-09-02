import { useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, shared } from '../theme';
import { PrimaryButton, SmallButton } from './Buttons';
import { parseImport, describePlan } from '../importText';

// Paste a brain dump; it becomes lists and tasks in one tap.
export default function ImportBox({ people, lists, routines = [], categories = [], onImport, onDone }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const plan = useMemo(() => parseImport(text, { people, lists, routines, categories }), [text, people, lists, routines, categories]);

  if (!open) {
    return (
      <View style={styles.section}>
        <View style={styles.header}>
          <Text style={styles.title}>Paste a list</Text>
          <SmallButton label="Open" onPress={() => setOpen(true)} />
        </View>
        <Text style={shared.muted}>Dump everything in one go. Headers become lists, dashes become tasks, indented dashes become steps.</Text>
      </View>
    );
  }

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Text style={styles.title}>Paste a list</Text>
        <SmallButton label="Close" onPress={() => setOpen(false)} />
      </View>
      <Text style={shared.muted}>
        A line ending in a colon starts a list; Today, Tomorrow, and weekdays go to that day. Add options in
        parentheses: "Exercise (weekly):" or "Zeke's day (daily, for Zeke):" make routines, "Soon (3 months):" makes
        a timeline list, "GFD (in Work):" puts a list in a category. "- task by fri 3pm for Zeke" sets a date, time, and person; "- 1 from Exercise" in a
        routine is a quota. Indent a dash under a task to make it a step. "// note" adds a note.
      </Text>
      <TextInput
        style={[shared.input, styles.box]}
        multiline
        value={text}
        onChangeText={setText}
        placeholder={'Groceries:\n- milk\n- eggs\nSchool:\n- read chapter 4 by fri\n  - find the pdf'}
        placeholderTextColor={colors.muted}
        autoCapitalize="none"
        autoCorrect={false}
      />
      <Text style={styles.preview}>{describePlan(plan)}</Text>
      {plan.lists.map((l) => (
        <Text key={l.name + (l.id || '')} style={styles.previewLine}>
          {l.name}
          {l.isNew ? ' (new list)' : ''}{l.categoryName ? ` in ${l.categoryName}` : ''}: {l.tasks.map((t) => t.text).join(' · ') || 'empty'}
        </Text>
      ))}
      {plan.routines.map((r) => (
        <Text key={'r' + r.name} style={styles.previewLine}>
          {r.name} ({r.cadence} routine{r.isNew ? ', new' : ''}): {r.items.map((it) => (it.type === 'task' ? it.text : `${it.count} from ${it.fromName}`)).join(' · ') || 'empty'}
        </Text>
      ))}
      <View style={styles.row}>
        <PrimaryButton
          label="Add these"
          onPress={() => {
            if (!plan.counts.tasks && !plan.counts.newLists && !plan.counts.routines) return;
            onImport(plan);
            setText('');
            setOpen(false);
            onDone?.(plan);
          }}
        />
        <SmallButton label="Clear" onPress={() => setText('')} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 36, paddingTop: 20, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  title: { fontSize: 15, fontWeight: '700', color: colors.muted, letterSpacing: 0.5, textTransform: 'uppercase' },
  box: { minHeight: 160, textAlignVertical: 'top', marginTop: 10, fontFamily: 'monospace', fontSize: 14 },
  preview: { marginTop: 8, fontSize: 13, color: colors.accent, fontWeight: '600' },
  previewLine: { fontSize: 12, color: colors.muted, marginTop: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
});
