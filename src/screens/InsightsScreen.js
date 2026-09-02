import { StyleSheet, Text, View } from 'react-native';
import { colors, shared } from '../theme';
import Screen from '../components/Screen';
import { formatDuration } from '../durations';
import { formatTime, describeDayKey } from '../dates';
import { estimateAccuracy, timeByList, timeByPerson, carryOvers, dayStats, trackedShare } from '../insights';

// Reality vs perception, and where things slip. Every section explains what
// it needs when there isn't enough data yet, so the tab is never blank.
export default function InsightsScreen({ store }) {
  const est = estimateAccuracy(store.timeLog);
  const byList = timeByList(store.timeLog, store.lists);
  const byPerson = timeByPerson(store.timeLog, store.people);
  const carries = carryOvers(store.tasks);
  const days = dayStats(store.days);
  const share = trackedShare(store.days, store.timeLog);
  const totalTracked = store.timeLog.reduce((s, e) => s + (e.durationMs || 0), 0);

  return (
    <Screen>
      <Text style={styles.title}>Insights</Text>
      <Text style={shared.muted}>
        {store.timeLog.length} timed {store.timeLog.length === 1 ? 'task' : 'tasks'} · {formatDuration(totalTracked) || '0m'} tracked
      </Text>

      <Section title="Estimates vs reality">
        {!est ? (
          <Text style={shared.muted}>
            Set an estimate on a task (long-press it), then Start and Finish it. After a few, this shows
            how your guesses compare with what actually happened.
          </Text>
        ) : (
          <View>
            <Big
              value={`${Math.round(est.median * 100)}%`}
              label={
                est.median > 1.1
                  ? 'Things take longer than you think. Typical task ran this much of its estimate.'
                  : est.median < 0.9
                    ? "You over-estimate. Typical task ran this much of its estimate."
                    : 'Your estimates are close. Typical task ran this much of its estimate.'
              }
            />
            <Text style={styles.detail}>
              {est.count} estimated · {est.over} ran well over · {est.under} ran well under
            </Text>
            {est.misses.length > 0 && (
              <View style={styles.list}>
                <Text style={styles.subhead}>Biggest misses</Text>
                {est.misses.map((m) => (
                  <Row key={m.id} left={m.text} right={`${formatDuration(m.durationMs)} vs ~${formatDuration(m.estimateMs)}`} />
                ))}
              </View>
            )}
          </View>
        )}
      </Section>

      <Section title="What keeps slipping">
        {carries.count === 0 ? (
          <Text style={shared.muted}>
            Nothing has been carried over in the morning review yet. Tasks that keep getting pushed show up here.
          </Text>
        ) : (
          <View>
            <Text style={styles.detail}>
              {carries.count} {carries.count === 1 ? 'task has' : 'tasks have'} been carried over
              {carries.repeat > 0 ? `, ${carries.repeat} more than once` : ''}.
            </Text>
            <View style={styles.list}>
              {carries.worst.map((t) => (
                <Row key={t.id} left={t.text} right={`${t.carriedCount}×${t.done ? ' · done' : ''}`} />
              ))}
            </View>
          </View>
        )}
      </Section>

      <Section title="Where the time goes">
        {byList.length === 0 ? (
          <Text style={shared.muted}>Timed tasks add up here by list and by person.</Text>
        ) : (
          <View>
            {byList.slice(0, 6).map((b) => (
              <Bar key={b.key} label={b.name} ms={b.ms} max={byList[0].ms} />
            ))}
            {byPerson.length > 1 && (
              <View style={styles.list}>
                <Text style={styles.subhead}>By person</Text>
                {byPerson.map((b) => (
                  <Bar key={b.key} label={b.name} ms={b.ms} max={byPerson[0].ms} />
                ))}
              </View>
            )}
          </View>
        )}
      </Section>

      <Section title="Days">
        {!days ? (
          <Text style={shared.muted}>
            Once a few days have both an "I'm up" and a "Good night" (tapped or detected), this shows how long
            your days run and how much of them is tracked.
          </Text>
        ) : (
          <View>
            <Big value={formatDuration(days.avgAwakeMs)} label={`awake on a typical day, over ${days.count} ${days.count === 1 ? 'day' : 'days'}`} />
            {days.avgSleepMs ? <Text style={styles.detail}>Detected sleep averages {formatDuration(days.avgSleepMs)}.</Text> : null}
            {share && share.trackedMs > 0 ? (
              <Text style={styles.detail}>
                {Math.round(share.share * 100)}% of awake time was on a timed task.
              </Text>
            ) : null}
            <View style={styles.list}>
              {days.recent.map((d) => (
                <Row
                  key={d.key}
                  left={describeDayKey(d.key)}
                  right={`${formatTime(d.wokeAt)} – ${formatTime(d.sleptAt)}${d.sleep ? ` · slept ${formatDuration(d.sleep.end - d.sleep.start)}` : ''}`}
                />
              ))}
            </View>
          </View>
        )}
      </Section>
    </Screen>
  );
}

function Section({ title, children }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Big({ value, label }) {
  return (
    <View style={styles.big}>
      <Text style={styles.bigValue}>{value}</Text>
      <Text style={styles.bigLabel}>{label}</Text>
    </View>
  );
}

function Row({ left, right }) {
  return (
    <View style={[styles.row, shared.hairline]}>
      <Text style={styles.rowLeft} numberOfLines={1}>
        {left}
      </Text>
      <Text style={styles.rowRight}>{right}</Text>
    </View>
  );
}

function Bar({ label, ms, max }) {
  const pct = max ? Math.max(4, Math.round((ms / max) * 100)) : 0;
  return (
    <View style={styles.bar}>
      <View style={styles.barHeader}>
        <Text style={styles.rowLeft} numberOfLines={1}>
          {label}
        </Text>
        <Text style={styles.rowRight}>{formatDuration(ms)}</Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${pct}%` }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 26, fontWeight: '700', color: colors.ink, marginBottom: 4 },
  section: { marginTop: 28, paddingTop: 20, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: colors.ink, marginBottom: 10 },
  big: { flexDirection: 'row', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' },
  bigValue: { fontSize: 34, fontWeight: '800', color: colors.accent },
  bigLabel: { fontSize: 14, color: colors.muted, flex: 1, minWidth: 160 },
  detail: { fontSize: 14, color: colors.muted, marginTop: 8 },
  subhead: { fontSize: 13, fontWeight: '700', color: colors.muted, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  list: { marginTop: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, gap: 12 },
  rowLeft: { flex: 1, fontSize: 15, color: colors.ink },
  rowRight: { fontSize: 13, color: colors.muted },
  bar: { marginTop: 8 },
  barHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4, gap: 12 },
  track: { height: 6, borderRadius: 3, backgroundColor: colors.line },
  fill: { height: 6, borderRadius: 3, backgroundColor: colors.accent },
});
