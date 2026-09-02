import { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import TaskRow from './TaskRow';
import { SmallButton } from './Buttons';
import { colors, shared } from '../theme';
import { tasksForList } from '../store';
import { childrenOf } from '../pickNext';

// One list of tasks with its own add box. Used for the day list and for each
// standing list. Steps (sub-tasks) render indented under their parent.
export default function TaskList({
  caption,
  listId,
  title,
  subtitle,
  subtitleWarn,
  tasks,
  emptyText,
  emptyHint,
  tagFor,
  onAdd,
  onToggle,
  onStart,
  onPause,
  onFinish,
  onDelete,
  onMove,
  onClearCompleted,
  onTitleLongPress,
  renaming,
  onRename,
  onCancelRename,
}) {
  const [input, setInput] = useState('');
  const [nameDraft, setNameDraft] = useState(title);
  const { all, done } = tasksForList(tasks, listId);

  useEffect(() => {
    if (renaming) setNameDraft(title);
  }, [renaming, title]);

  const submit = () => {
    onAdd(input, listId);
    setInput('');
  };

  const rowProps = { tagFor, onToggle, onStart, onPause, onFinish, onDelete, onLongPress: onMove };

  return (
    <View style={styles.section}>
      {caption ? <Text style={{ fontSize: 12, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', color: colors.muted, marginTop: 18, marginBottom: -6 }}>{caption}</Text> : null}
      <View style={styles.header}>
        {renaming ? (
          <TextInput
            style={[shared.input, styles.renameInput]}
            value={nameDraft}
            onChangeText={setNameDraft}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={() => onRename(listId, nameDraft)}
            onBlur={onCancelRename}
          />
        ) : (
          <TouchableOpacity
            onLongPress={onTitleLongPress ? () => onTitleLongPress(listId) : undefined}
            delayLongPress={350}
            disabled={!onTitleLongPress}
            accessibilityRole={onTitleLongPress ? 'button' : undefined}
            accessibilityHint={onTitleLongPress ? 'Long press to rename or delete this list' : undefined}
          >
            <Text style={styles.title}>{title}</Text>
            {subtitle ? <Text style={[styles.subtitle, subtitleWarn && styles.subtitleWarn]}>{subtitle}</Text> : null}
          </TouchableOpacity>
        )}
        {done.length > 0 && (
          <SmallButton label={`Clear ${done.length} done`} onPress={() => onClearCompleted(listId)} />
        )}
      </View>

      <View style={styles.inputRow}>
        <TextInput
          style={shared.input}
          value={input}
          onChangeText={setInput}
          placeholder="Add a task…"
          placeholderTextColor={colors.muted}
          returnKeyType="done"
          onSubmitEditing={submit}
          submitBehavior="submit"
        />
        <TouchableOpacity style={shared.primaryButton} onPress={submit} accessibilityRole="button">
          <Text style={shared.primaryButtonText}>Add</Text>
        </TouchableOpacity>
      </View>

      {all.length === 0 && (
        <View style={styles.empty}>
          <Text style={shared.muted}>{emptyText}</Text>
          {emptyHint ? <Text style={styles.emptyHint}>{emptyHint}</Text> : null}
        </View>
      )}

      {all.map((t) => {
        const kids = childrenOf(tasks, t.id);
        return (
          <View key={t.id}>
            <TaskRow task={t} steps={kids} tag={tagFor ? tagFor(t) : null} {...rowProps} />
            {kids.all.length > 0 && (
              <View style={styles.steps}>
                {[...kids.open, ...kids.done].map((step) => (
                  <TaskRow key={step.id} task={step} isStep tag={null} {...rowProps} />
                ))}
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 28 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    minHeight: 32,
  },
  title: { fontSize: 17, fontWeight: '700', color: colors.ink, letterSpacing: -0.2 },
  subtitle: { fontSize: 12, color: colors.muted, marginTop: 1 },
  subtitleWarn: { color: colors.warn, fontWeight: '600' },
  renameInput: { fontSize: 18, fontWeight: '700', paddingVertical: 6, marginRight: 10 },
  inputRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  empty: { paddingVertical: 4 },
  emptyHint: { fontSize: 12, color: colors.muted, marginTop: -4 },
  steps: { marginLeft: 34, borderLeftWidth: 2, borderLeftColor: colors.line, paddingLeft: 8 },
});
