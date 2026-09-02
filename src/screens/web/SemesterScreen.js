import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, shared } from '../../theme';
import WebPage from './WebPage';
import { dayKey, parseDayKey } from '../../dates';
import { almanacToday } from '../../clock';
import { formatDuration } from '../../durations';

// Every Canvas assignment on a grid: courses down the side, weeks across.
// Each cell holds that week's assignments; the bottom row sums count and
// estimated hours per week, so crunch weeks show before they arrive.

const DAY = 86400000;
const weekStartOf = (key) => {
  const d = parseDayKey(key);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
};

export default function SemesterScreen({ store, onOpenTask }) {
  const today = almanacToday();
  const assignments = store.tasks.filter((t) => t.canvasId && t.due);
  const courses = store.canvas?.courses || [];

  const { weeks, byCourse, totals } = useMemo(() => {
    if (assignments.length === 0) return { weeks: [], byCourse: [], totals: [] };
    const keys = assignments.map((t) => t.due).sort();
    const first = weekStartOf(keys[0] < today ? keys[0] : today);
    const last = weekStartOf(keys[keys.length - 1]);
    const weeks = [];
    for (let d = new Date(first); d <= last; d = new Date(d.getTime() + 7 * DAY)) weeks.push(dayKey(d));
    const courseNames = [...new Set(assignments.map((t) => t.canvasCourse || 'Course'))].sort();
    const byCourse = courseNames.map((name) => ({
      name,
      grade: courses.find((c) => c.code === name || c.name === name),
      cells: weeks.map((w) => assignments.filter((t) => (t.canvasCourse || 'Course') === name && dayKey(weekStartOf(t.due)) === w)),
    }));
    const totals = weeks.map((w) => {
      const items = assignments.filter((t) => dayKey(weekStartOf(t.due)) === w && !t.done);
      return { count: items.length, est: items.reduce((s, t) => s + (t.estimateMs || 0), 0), points: items.reduce((s, t) => s + (t.canvasPoints || 0), 0) };
    });
    return { weeks, byCourse, totals };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.tasks, store.canvas, today]);

  const thisWeek = dayKey(weekStartOf(today));
  const maxCount = Math.max(1, ...totals.map((t) => t.count));

  return (
    <WebPage title="Semester" subtitle="Every assignment by course and week. Double-click one to open it." wide>
      {assignments.length === 0 ? (
        <Text style={shared.muted}>Connect Canvas on the phone and assignments appear here after the next sync.</Text>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', minWidth: 140 + weeks.length * 150 }}>
            <thead>
              <tr>
                <th style={th(true)}>Course</th>
                {weeks.map((w) => (
                  <th key={w} style={{ ...th(false), background: w === thisWeek ? colors.accentSoft : 'transparent' }}>
                    {parseDayKey(w).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                    {w === thisWeek ? <div style={{ fontSize: 10, color: colors.accent }}>this week</div> : null}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {byCourse.map((row) => (
                <tr key={row.name}>
                  <td style={{ ...td, fontWeight: 700, whiteSpace: 'nowrap' }}>
                    {row.name}
                    {row.grade?.score != null ? <div style={{ fontSize: 11, color: colors.muted, fontWeight: 400 }}>{Math.round(row.grade.score)}%</div> : null}
                  </td>
                  {row.cells.map((cell, i) => (
                    <td key={weeks[i]} style={{ ...td, verticalAlign: 'top', background: weeks[i] === thisWeek ? colors.accentSoft : 'transparent' }}>
                      {cell.map((t) => (
                        <div
                          key={t.id}
                          onDoubleClick={() => onOpenTask(t)}
                          title={`${t.text}${t.canvasPoints != null ? ` · ${t.canvasPoints} pts` : ''}${t.estimateMs ? ` · ~${formatDuration(t.estimateMs)}` : ''}`}
                          style={{
                            fontSize: 12,
                            padding: '3px 6px',
                            marginBottom: 4,
                            borderRadius: 6,
                            border: `1px solid ${t.done ? colors.line : t.due < today ? colors.danger : colors.accent}`,
                            color: t.done ? colors.muted : colors.ink,
                            textDecoration: t.done ? 'line-through' : 'none',
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            maxWidth: 140,
                          }}
                        >
                          {parseDayKey(t.due).toLocaleDateString([], { weekday: 'short' })} · {t.text}
                        </div>
                      ))}
                    </td>
                  ))}
                </tr>
              ))}
              <tr>
                <td style={{ ...td, fontWeight: 700, color: colors.muted }}>Load</td>
                {totals.map((t, i) => (
                  <td key={weeks[i]} style={{ ...td, verticalAlign: 'bottom' }}>
                    <div style={{ height: 40, display: 'flex', alignItems: 'flex-end' }}>
                      <div style={{ width: '100%', height: `${Math.max(4, (t.count / maxCount) * 40)}px`, background: t.count >= maxCount && maxCount > 1 ? colors.warn : colors.accent, borderRadius: 3, opacity: t.count ? 1 : 0.15 }} />
                    </div>
                    <div style={{ fontSize: 11, color: colors.muted, marginTop: 4 }}>
                      {t.count} due{t.est ? ` · ~${formatDuration(t.est)}` : ''}{t.points ? ` · ${t.points} pts` : ''}
                    </div>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}
      <View style={styles.legend}>
        <Text style={shared.muted}>Red outline: past due. Amber bar: the heaviest week. Estimates come from the task sheet; set them and the load row gets honest.</Text>
      </View>
    </WebPage>
  );
}

const th = (left) => ({ textAlign: left ? 'left' : 'center', fontSize: 12, color: colors.muted, padding: '6px 8px', borderBottom: `1px solid ${colors.line}`, position: 'sticky', top: 0, background: colors.bg });
const td = { padding: '6px 8px', borderBottom: `1px solid ${colors.line}`, fontSize: 13, color: colors.ink, minWidth: 140 };

const styles = StyleSheet.create({
  legend: { marginTop: 14 },
});
