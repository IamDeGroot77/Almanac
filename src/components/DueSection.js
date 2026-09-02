import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';
import TaskRow from './TaskRow';

// Tasks from named lists (or other days) that are overdue or due today.
export default function DueSection({ overdue, dueToday, contextFor, listProps }) {
  if (overdue.length === 0 && dueToday.length === 0) return null;
  const render = (t) => (
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
  );
  return (
    <View style={styles.section}>
      {overdue.length > 0 && (
        <View>
          <Text style={[styles.title, styles.overdue]}>Overdue</Text>
          {overdue.map(render)}
        </View>
      )}
      {dueToday.length > 0 && (
        <View style={overdue.length > 0 && styles.gap}>
          <Text style={styles.title}>Due today</Text>
          {dueToday.map(render)}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 28 },
  title: { fontSize: 17, fontWeight: '700', color: colors.ink, letterSpacing: -0.2, marginBottom: 4 },
  overdue: { color: colors.danger },
  gap: { marginTop: 16 },
});
