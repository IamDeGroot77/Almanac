import { StyleSheet, Text, View } from 'react-native';
import { colors, shared } from '../../theme';
import { BarChart, LineChart, Scatter } from '../../components/web/Charts';
import { formatDuration } from '../../durations';
import { dayKey } from '../../dates';
import { energyLabel } from '../../components/EnergyPrompt';

// Laptop-only charts placed above the Insights lists. Everything is derived
// from the store on the fly, so the picture is always current.

const DAY = 86400000;

export default function DashboardSections({ store }) {
  const log = store.timeLog || [];
  const days = store.days || {};

  // Estimate accuracy over time: ratio per timed task, in order.
  const ratios = log
    .filter((e) => e.estimateMs > 0 && e.durationMs > 0)
    .slice(-30)
    .map((e) => ({ x: new Date(e.doneAt).toLocaleDateString([], { month: 'numeric', day: 'numeric' }), y: Math.round((e.durationMs / e.estimateMs) * 100), hint: `${e.text}: ${formatDuration(e.durationMs)} vs ~${formatDuration(e.estimateMs)}` }));

  // Tracked hours per day, last 14 days.
  const now = Date.now();
  const perDay = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(now - (13 - i) * DAY);
    const key = dayKey(d);
    const ms = log.filter((e) => dayKey(new Date(e.doneAt)) === key).reduce((s, e) => s + (e.durationMs || 0), 0);
    return { label: d.toLocaleDateString([], { weekday: 'narrow' }), value: Math.round((ms / 3600000) * 10) / 10, hint: `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })}: ${formatDuration(ms) || '0m'}` };
  });

  // Hours by course.
  const byCourse = new Map();
  for (const t of store.tasks) if (t.canvasCourse && t.durationMs) byCourse.set(t.canvasCourse, (byCourse.get(t.canvasCourse) || 0) + t.durationMs);
  const courseBars = [...byCourse.entries()].map(([label, ms]) => ({ label, value: Math.round((ms / 3600000) * 10) / 10, hint: `${label}: ${formatDuration(ms)}` }));

  // Energy at wake vs tasks done that day.
  const energyPoints = Object.entries(days)
    .filter(([, d]) => d.energy?.wake && d.wokeAt)
    .map(([key, d]) => {
      const end = d.sleptAt || d.wokeAt + 18 * 3600000;
      const done = store.tasks.filter((t) => t.done && t.doneAt >= d.wokeAt && t.doneAt < end).length;
      return { x: d.energy.wake, y: done, hint: `${key}: ${energyLabel(d.energy.wake)} morning, ${done} done` };
    });

  // Sleep length vs next-day tasks done.
  const sleepPoints = Object.entries(days)
    .filter(([, d]) => d.sleep && d.wokeAt)
    .map(([key, d]) => {
      const end = d.sleptAt || d.wokeAt + 18 * 3600000;
      const done = store.tasks.filter((t) => t.done && t.doneAt >= d.wokeAt && t.doneAt < end).length;
      const hours = Math.round(((d.sleep.end - d.sleep.start) / 3600000) * 10) / 10;
      return { x: hours, y: done, hint: `${key}: slept ${hours}h, ${done} done` };
    });

  return (
    <View style={styles.grid}>
      <Panel title="Estimates over time" hint="100% means it took exactly as long as you guessed. Above the line took longer.">
        {ratios.length < 2 ? <Text style={shared.muted}>Needs a couple of timed tasks with estimates.</Text> : <LineChart points={ratios} baseline={100} yLabel={(v) => `${v}%`} />}
      </Panel>
      <Panel title="Tracked hours, last 14 days">
        <BarChart data={perDay} valueLabel={(v) => `${v}h`} />
      </Panel>
      <Panel title="Hours by course">
        {courseBars.length === 0 ? <Text style={shared.muted}>Time assignments with Start and Finish and this fills in.</Text> : <BarChart data={courseBars} valueLabel={(v) => `${v}h`} />}
      </Panel>
      <Panel title="Morning energy vs tasks done">
        {energyPoints.length < 3 ? <Text style={shared.muted}>Answer the morning energy check for a few days.</Text> : <Scatter points={energyPoints} xLabel="energy (1 low – 3 good)" yLabel="done" />}
      </Panel>
      <Panel title="Sleep vs next-day output">
        {sleepPoints.length < 3 ? <Text style={shared.muted}>Turn on sleep detection; a few nights in, this shows whether sleep predicts your day.</Text> : <Scatter points={sleepPoints} xLabel="hours slept" yLabel="done" />}
      </Panel>
    </View>
  );
}

function Panel({ title, hint, children }) {
  return (
    <View style={styles.panel}>
      <Text style={styles.panelTitle}>{title}</Text>
      {hint ? <Text style={styles.panelHint}>{hint}</Text> : null}
      <View style={styles.panelBody}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginTop: 8 },
  panel: { flexGrow: 1, flexBasis: 480, borderWidth: 1, borderColor: colors.line, borderRadius: 12, padding: 14 },
  panelTitle: { fontSize: 15, fontWeight: '700', color: colors.ink },
  panelHint: { fontSize: 12, color: colors.muted, marginTop: 2 },
  panelBody: { marginTop: 10 },
});
