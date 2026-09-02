import { useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { colors, shared } from '../../theme';
import WebPage from './WebPage';
import { SmallButton } from '../../components/Buttons';
import { dayKey, parseDayKey } from '../../dates';
import { almanacToday } from '../../clock';
import { formatDuration } from '../../durations';
import { describeCode } from '../../weather';
import { blocksForDay, colorForCategory, describeBlockTime } from '../../blocks';

// The week as seven columns. Drag a task onto a day to move it (day-list
// tasks) or to give it a due date (tasks from named lists). Click a task
// then a column does the same without dragging. A side rail lists the
// unscheduled tasks from named lists, ready to be pulled onto a day.

const DAY = 86400000;
const weekStartOf = (key) => {
  const d = parseDayKey(key);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // Monday
  return d;
};

export default function PlannerScreen({ store, people, events, forecast, onOpenTask, onStart }) {
  const today = almanacToday();
  const [weekOffset, setWeekOffset] = useState(0);
  const [picked, setPicked] = useState(null); // task id chosen by click, awaiting a column
  const [dragOver, setDragOver] = useState(null);

  const start = weekStartOf(today);
  start.setDate(start.getDate() + weekOffset * 7);
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start.getTime() + i * DAY);
    return { key: dayKey(d), date: d };
  });
  const weekLabel = `${start.toLocaleDateString([], { month: 'short', day: 'numeric' })} – ${new Date(start.getTime() + 6 * DAY).toLocaleDateString([], { month: 'short', day: 'numeric' })}`;

  const visible = people.visibleTasks.filter((t) => !t.parentId);
  const listName = (id) => store.lists.find((l) => l.id === id)?.name || '';

  const columns = useMemo(
    () =>
      days.map((d) => {
        const onDay = visible.filter((t) => t.listId === `day:${d.key}`);
        const due = visible.filter((t) => t.due === d.key && t.listId !== `day:${d.key}`);
        const est = [...onDay, ...due].filter((t) => !t.done).reduce((s, t) => s + (t.estimateMs || 0), 0);
        const dayEvents = (events || []).filter((e) => e.dayKey === d.key);
        const blocks = blocksForDay(store.prefs.dayBlocks, d.date).map((b) => ({ ...b, name: (store.categories || []).find((c) => c.id === b.categoryId)?.name || 'Block', color: colorForCategory(store.categories || [], b.categoryId) }));
        const weather = forecast?.days?.find((w) => w.date === d.key);
        return { ...d, onDay, due, est, events: dayEvents, blocks, weather };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [visible, events, forecast, weekOffset]
  );

  const unscheduled = visible.filter((t) => !t.done && !t.listId.startsWith('day:') && !t.due);

  const dropOn = (taskId, key) => {
    const task = store.tasks.find((t) => t.id === taskId);
    if (!task) return;
    if (task.listId.startsWith('day:')) store.moveTask(taskId, `day:${key}`);
    else store.setTaskDue(taskId, key, task.dueTime || null);
    setPicked(null);
    setDragOver(null);
  };

  const dragProps = (task) => ({
    draggable: true,
    onDragStart: (e) => {
      e.dataTransfer.setData('text/plain', task.id);
      e.dataTransfer.effectAllowed = 'move';
    },
  });
  const dropProps = (key) => ({
    onDragOver: (e) => {
      e.preventDefault();
      if (dragOver !== key) setDragOver(key);
    },
    onDragLeave: () => dragOver === key && setDragOver(null),
    onDrop: (e) => {
      e.preventDefault();
      const id = e.dataTransfer.getData('text/plain');
      if (id) dropOn(id, key);
    },
  });

  return (
    <WebPage
      title="Week"
      subtitle={`${weekLabel} · drag a task onto a day, or click a task then a day`}
      wide
      actions={
        <>
          <SmallButton label="‹ Prev" onPress={() => setWeekOffset(weekOffset - 1)} />
          <SmallButton label="This week" onPress={() => setWeekOffset(0)} />
          <SmallButton label="Next ›" onPress={() => setWeekOffset(weekOffset + 1)} />
        </>
      }
    >
      <View style={styles.board}>
        <div style={{ display: 'flex', gap: 8, flex: 1, minWidth: 0 }}>
          {columns.map((c) => {
            const isToday = c.key === today;
            const past = c.key < today;
            return (
              <div
                key={c.key}
                {...dropProps(c.key)}
                onClick={() => picked && dropOn(picked, c.key)}
                style={{
                  flex: 1,
                  minWidth: 0,
                  borderRadius: 12,
                  border: `1px solid ${dragOver === c.key || (picked && !past) ? colors.accent : colors.line}`,
                  background: dragOver === c.key ? colors.accentSoft : colors.bg,
                  padding: 10,
                  opacity: past ? 0.75 : 1,
                  cursor: picked ? 'copy' : 'default',
                  minHeight: 320,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span style={{ fontWeight: 700, color: isToday ? colors.accent : colors.ink, fontSize: 14 }}>
                    {c.date.toLocaleDateString([], { weekday: 'short' })} {c.date.getDate()}
                  </span>
                  {c.weather ? (
                    <span style={{ fontSize: 11, color: colors.muted }} title={describeCode(c.weather.code)}>
                      {c.weather.high}°
                    </span>
                  ) : null}
                </div>
                {c.est > 0 ? <div style={{ fontSize: 11, color: colors.muted, marginBottom: 4 }}>~{formatDuration(c.est)} planned</div> : <div style={{ height: 17 }} />}

                {c.blocks.map((b) => (
                  <div key={b.id} title={`${b.name} time, ${describeBlockTime(b)}`} style={{ fontSize: 11, color: '#fff', padding: '2px 6px', marginBottom: 3, borderRadius: 4, background: b.color, opacity: 0.85, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {b.name} · {describeBlockTime(b)}
                  </div>
                ))}

                {c.events.map((e) => (
                  <div key={e.id} style={{ fontSize: 12, color: colors.muted, padding: '3px 0', borderBottom: `1px solid ${colors.line}` }}>
                    {e.time} {e.title}
                  </div>
                ))}

                {c.due.map((t) => (
                  <Card key={t.id} task={t} context={listName(t.listId)} picked={picked === t.id} onPick={setPicked} onOpen={onOpenTask} onStart={onStart} dragProps={dragProps(t)} due />
                ))}
                {c.onDay.map((t) => (
                  <Card key={t.id} task={t} picked={picked === t.id} onPick={setPicked} onOpen={onOpenTask} onStart={onStart} dragProps={dragProps(t)} />
                ))}

                <QuickAdd onAdd={(text) => store.addTask(text, `day:${c.key}`, people.personFilter !== 'all' ? people.personFilter : null)} />
              </div>
            );
          })}
        </div>

        <div style={{ width: 220, flexShrink: 0, borderRadius: 12, border: `1px solid ${colors.line}`, padding: 10, maxHeight: 640, overflowY: 'auto' }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Unscheduled</div>
          {unscheduled.length === 0 ? <div style={{ fontSize: 13, color: colors.muted }}>Everything on your lists has a day.</div> : null}
          {unscheduled.map((t) => (
            <Card key={t.id} task={t} context={listName(t.listId)} picked={picked === t.id} onPick={setPicked} onOpen={onOpenTask} onStart={onStart} dragProps={dragProps(t)} />
          ))}
        </div>
      </View>
      {picked ? (
        <Text style={styles.pickHint}>
          Now click a day to move "{store.tasks.find((t) => t.id === picked)?.text}" there.{' '}
          <Text style={styles.link} onPress={() => setPicked(null)}>
            Cancel
          </Text>
        </Text>
      ) : null}
    </WebPage>
  );
}

function Card({ task, context, picked, onPick, onOpen, onStart, dragProps, due }) {
  return (
    <div
      {...dragProps}
      onClick={(e) => {
        e.stopPropagation();
        onPick(picked ? null : task.id);
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onOpen(task);
      }}
      title="Click to pick up, double-click to open"
      style={{
        margin: '6px 0',
        padding: '6px 8px',
        borderRadius: 8,
        border: `1px solid ${picked ? colors.accent : colors.line}`,
        background: picked ? colors.accentSoft : colors.bg,
        cursor: 'grab',
        fontSize: 13,
        color: task.done ? colors.muted : colors.ink,
        textDecoration: task.done ? 'line-through' : 'none',
        userSelect: 'none',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6 }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.text}</span>
        {!task.done ? (
          <span
            onClick={(e) => {
              e.stopPropagation();
              onStart(task.id);
            }}
            style={{ color: colors.accent, fontWeight: 700, cursor: 'pointer', fontSize: 11 }}
            title="Start"
          >
            ▶
          </span>
        ) : null}
      </div>
      <div style={{ fontSize: 11, color: colors.muted, marginTop: 2 }}>
        {[context, due && task.dueTime ? `due ${task.dueTime}` : due ? 'due' : null, task.estimateMs ? `~${formatDuration(task.estimateMs)}` : null, task.canvasCourse]
          .filter(Boolean)
          .join(' · ')}
      </div>
    </div>
  );
}

function QuickAdd({ onAdd }) {
  const [text, setText] = useState('');
  return (
    <TextInput
      style={[shared.input, styles.quick]}
      value={text}
      onChangeText={setText}
      placeholder="+ add"
      placeholderTextColor={colors.muted}
      onSubmitEditing={() => {
        if (text.trim()) onAdd(text);
        setText('');
      }}
      submitBehavior="submit"
    />
  );
}

const styles = StyleSheet.create({
  board: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  quick: { flex: 0, marginTop: 8, paddingVertical: 6, fontSize: 13 },
  pickHint: { marginTop: 12, fontSize: 13, color: colors.muted },
  link: { color: colors.accent, fontWeight: '600' },
});
