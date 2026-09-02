import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';
import Screen from '../components/Screen';
import PersonChips from '../components/PersonChips';
import TaskList from '../components/TaskList';
import { SmallButton } from '../components/Buttons';
import { personOf, personName } from '../store';

export default function ListsScreen({
  lists,
  allListsCount,
  people,
  personFilter,
  setPersonFilter,
  onAddPerson,
  filterName,
  googleConnected,
  onNewList,
  onListOptions,
  renamingListId,
  onRename,
  onCancelRename,
  onRefresh,
  refreshing,
  listProps,
}) {
  return (
    <Screen refreshing={refreshing} onRefresh={onRefresh}>
      <View style={styles.header}>
        <Text style={styles.title}>Lists{filterName ? ` · ${filterName}` : ''}</Text>
        <SmallButton label="+ New list" onPress={onNewList} />
      </View>

      <View style={styles.people}>
        <PersonChips
          people={people}
          selected={personFilter}
          onSelect={setPersonFilter}
          allowAll
          onAdd={onAddPerson}
        />
      </View>

      {lists.length === 0 && (
        <Text style={styles.hint}>
          {allListsCount === 0
            ? "Named lists hold things that aren't tied to a day, like Groceries or Home. They sync with Google Tasks when you're connected."
            : `No lists for ${filterName} yet.`}
        </Text>
      )}

      {lists.map((list) => (
        <TaskList
          key={list.id}
          listId={list.id}
          title={list.name}
          subtitle={
            [
              personFilter === 'all' && personOf(list) !== 'me'
                ? `For ${personName(people, list.personId)}`
                : null,
              list.googleListId && googleConnected ? 'Synced with Google Tasks' : null,
            ]
              .filter(Boolean)
              .join(' · ') || null
          }
          emptyText="Empty."
          onTitleLongPress={onListOptions}
          renaming={renamingListId === list.id}
          onRename={onRename}
          onCancelRename={onCancelRename}
          {...listProps}
        />
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 26, fontWeight: '700', color: colors.ink },
  people: { marginTop: 14 },
  hint: { marginTop: 20, fontSize: 14, color: colors.muted },
});
