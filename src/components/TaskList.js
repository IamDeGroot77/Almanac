import { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import TaskRow from './TaskRow';
import { SmallButton } from './Buttons';
import { colors, shared } from '../theme';
import { tasksForList } from '../store';

// One list of tasks with its own add box. Used for the day list and for each
// standing list.
export default function TaskList({
  listId,
  title,
  subtitle,
  tasks,
  emptyText,
  onAdd,
  onToggle,
  onStart,
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

  // Start each rename from the current name.
  useEffect(() => {
    if (renaming) setNameDraft(title);
  }, [renaming, title]);

  const submit = () => {
    onAdd(input, listId);
    setInput('');
  };

  return (
    <View style={styles.section}>
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
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
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

      {all.length === 0 && <Text style={shared.muted}>{emptyText}</Text>}

      {all.map((t) => (
        <TaskRow
          key={t.id}
          task={t}
          onToggle={onToggle}
          onStart={onStart}
          onFinish={onFinish}
          onDelete={onDelete}
          onLongPress={onMove}
        />
      ))}
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
  title: { fontSize: 18, fontWeight: '700', color: colors.ink },
  subtitle: { fontSize: 12, color: colors.muted, marginTop: 1 },
  renameInput: { fontSize: 18, fontWeight: '700', paddingVertical: 6, marginRight: 10 },
  inputRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
});
