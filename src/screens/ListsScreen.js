import { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, shared } from '../theme';
import Screen from '../components/Screen';
import PersonChips from '../components/PersonChips';
import TaskList from '../components/TaskList';
import { SmallButton } from '../components/Buttons';
import SearchBox, { matchesQuery } from '../components/SearchBox';
import { personOf, personName } from '../store';
import ImportBox from '../components/ImportBox';
import { isWeb } from '../platform';

export default function ListsScreen({
  lists,
  allLists,
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
  routines,
  onNewRoutine,
  onEditRoutine,
  onRefresh,
  refreshing,
  listProps,
  allTasks,
  contextFor,
  google,
  onImport,
  allRoutines = [],
  categories = [],
  diag = false,
}) {
  const [query, setQuery] = useState('');
  const [stage, setStage] = useState(1);
  const show = (n) => !diag || stage >= n;
  if (diag) console.log('Lists step-by-step: showing parts up to', stage);
  const STEPS = ['header', 'search', 'lists', 'routines', 'paste box'];
  const searchResults = query ? allTasks.filter((t) => matchesQuery(t, query, allLists)).slice(0, 50) : [];
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

      {diag ? (
        <View style={styles.diag}>
          <Text style={styles.diagText}>Step-by-step mode · showing {stage} of {STEPS.length}: {STEPS.slice(0, stage).join(', ')}</Text>
          {stage < STEPS.length ? <SmallButton label={`Show ${STEPS[stage]}`} onPress={() => setStage(stage + 1)} /> : null}
        </View>
      ) : null}

      {show(2) ? (
      <SearchBox
        query={query}
        onChange={setQuery}
        results={searchResults}
        contextFor={contextFor}
        listProps={listProps}
      />
      ) : null}

      {query || !show(3) ? null : (
        <View>
      {lists.length === 0 && (
        <Text style={styles.hint}>
          {allListsCount === 0
            ? "Named lists hold things that aren't tied to a day, like Groceries or Home. They sync with Google Tasks when you're connected."
            : `No lists for ${filterName} yet.`}
        </Text>
      )}

      {groupedLists(lists, categories).map(({ list, caption }) => (
        <TaskList
          key={list.id}
          caption={caption}
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

      {show(4) ? (
      <View>
      <View style={styles.routinesHeader}>
        <Text style={styles.routinesTitle}>Routines</Text>
        <SmallButton label="+ New routine" onPress={onNewRoutine} />
      </View>
      <Text style={styles.hint}>
        Daily and weekly lists that start over each period. Quotas like "3 from Groceries" count
        themselves. They show on Today.
      </Text>
      {routines.map((r) => (
        <TouchableOpacity
          key={r.id}
          style={[styles.routineRow, shared.hairline]}
          onPress={() => onEditRoutine(r)}
          accessibilityRole="button"
        >
          <View style={styles.routineBody}>
            <Text style={styles.routineName}>{r.name}</Text>
            <Text style={styles.routineMeta}>
              {r.cadence === 'weekly' ? 'Every week' : 'Every day'} · {r.items.length}{' '}
              {r.items.length === 1 ? 'item' : 'items'}
              {personOf(r) !== 'me' ? ` · for ${personName(people, r.personId)}` : ''}
            </Text>
          </View>
          <Text style={styles.chev}>›</Text>
        </TouchableOpacity>
      ))}
      </View>
      ) : null}
        </View>
      )}
      {show(5) ? <ImportBox people={people} lists={allLists} routines={allRoutines} categories={categories} onImport={onImport} /> : null}
    </Screen>
  );
}

// Lists sorted by category then name; the first list of each category carries a caption.
function groupedLists(lists, categories) {
  const catName = (id) => categories.find((c) => c.id === id)?.name || '';
  const sorted = [...lists].sort((a, b) => {
    const ca = a.categoryId ? catName(a.categoryId) : '￿';
    const cb = b.categoryId ? catName(b.categoryId) : '￿';
    return ca.localeCompare(cb) || (a.createdAt || 0) - (b.createdAt || 0);
  });
  let last = null;
  return sorted.map((list) => {
    const key = list.categoryId || null;
    const caption = key !== last ? (key ? catName(key) : lists.some((l) => l.categoryId) ? 'Other' : null) : null;
    last = key;
    return { list, caption };
  });
}

const styles = StyleSheet.create({
  diag: { marginTop: 12, padding: 10, borderRadius: 10, backgroundColor: colors.warnSoft, gap: 8 },
  diagText: { fontSize: 13, color: colors.ink },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 26, fontWeight: '700', color: colors.ink },
  people: { marginTop: 14 },
  hint: { marginTop: 8, fontSize: 13, color: colors.muted },
  routinesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 36,
    paddingTop: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
  },
  routinesTitle: { fontSize: 15, fontWeight: '700', color: colors.muted, letterSpacing: 0.5, textTransform: 'uppercase' },
  routineRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  routineBody: { flex: 1 },
  routineName: { fontSize: 16, color: colors.ink, fontWeight: '600' },
  routineMeta: { fontSize: 12, color: colors.muted, marginTop: 1 },
  chev: { fontSize: 22, color: colors.muted, paddingHorizontal: 6 },
});
