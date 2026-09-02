import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { colors, shared } from '../theme';
import TaskRow from './TaskRow';

// Search across every task, list, and note. Shows results in place of the
// lists while a query is typed.
export function matchesQuery(task, q, lists) {
  const needle = q.trim().toLowerCase();
  if (!needle) return false;
  const listName = lists.find((l) => l.id === task.listId)?.name || '';
  return (
    task.text.toLowerCase().includes(needle) ||
    (task.notes || '').toLowerCase().includes(needle) ||
    (task.canvasCourse || '').toLowerCase().includes(needle) ||
    listName.toLowerCase().includes(needle)
  );
}

export default function SearchBox({ query, onChange, results, contextFor, listProps }) {
  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <TextInput
          style={[shared.input, styles.input]}
          value={query}
          onChangeText={onChange}
          placeholder="Search tasks and notes"
          placeholderTextColor={colors.muted}
          autoCorrect={false}
          returnKeyType="search"
        />
        {query ? (
          <TouchableOpacity onPress={() => onChange('')} hitSlop={10} accessibilityLabel="Clear search">
            <Text style={styles.clear}>✕</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      {query ? (
        <View style={styles.results}>
          {results.length === 0 ? (
            <Text style={shared.muted}>Nothing matches "{query}".</Text>
          ) : (
            results.map((t) => (
              <TaskRow
                key={t.id}
                task={t}
                tag={listProps.tagFor ? listProps.tagFor(t) : null}
                context={contextFor(t)}
                onToggle={listProps.onToggle}
                onStart={listProps.onStart}
                onPause={listProps.onPause}
                onFinish={listProps.onFinish}
                onDelete={listProps.onDelete}
                onLongPress={listProps.onMove}
              />
            ))
          )}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: { paddingVertical: 8 },
  clear: { color: colors.muted, fontSize: 16, paddingHorizontal: 6 },
  results: { marginTop: 8 },
});
