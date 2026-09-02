import { useMemo, useState } from 'react';
import { personOf, personName } from '../store';

// The Me / Zeke / All filter and everything it narrows.
export default function usePeopleFilter(store) {
  const [personFilter, setPersonFilter] = useState('all'); // 'all' | person id

  const matches = (item) => personFilter === 'all' || personOf(item) === personFilter;

  const visibleTasks = useMemo(
    () => store.tasks.filter(matches),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [store.tasks, personFilter]
  );
  const visibleLists = store.lists.filter(
    (l) => personFilter === 'all' || personOf(l) === personFilter || store.tasks.some((t) => t.listId === l.id && matches(t))
  );
  const visibleRoutines = store.routines.filter(matches);
  const filterName = personFilter === 'all' ? null : personName(store.people, personFilter);

  // Person tag shown on a row: only in the All view, only for people other than me.
  const tagFor = (t) => (personFilter === 'all' && personOf(t) !== 'me' ? personName(store.people, t.personId) : null);

  // New things take the filtered person, else the list's person.
  const addTask = (text, listId) => {
    const list = store.lists.find((l) => l.id === listId);
    return store.addTask(text, listId, personFilter !== 'all' ? personFilter : list?.personId || null);
  };
  const addList = (name) => store.addList(name, personFilter !== 'all' ? personFilter : null);
  const defaultPerson = personFilter !== 'all' ? personFilter : 'me';

  return {
    personFilter,
    setPersonFilter,
    visibleTasks,
    visibleLists,
    visibleRoutines,
    filterName,
    tagFor,
    addTask,
    addList,
    defaultPerson,
  };
}
