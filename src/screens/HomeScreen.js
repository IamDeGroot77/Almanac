import { useMemo } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, shared } from '../theme';
import Screen from '../components/Screen';
import ScratchCard from '../components/ScratchCard';
import ImportBox from '../components/ImportBox';
import ReviewCard from '../components/ReviewCard';
import { SmallButton, PrimaryButton } from '../components/Buttons';
import WeatherLine from '../components/WeatherLine';
import { quoteOfDay } from '../quotes';
import { streaks } from '../achievements';
import { describeBlockTime } from '../blocks';
import { formatDuration, useNow, elapsedFor } from '../durations';
import { minutesToday } from '../routines';
import { formatHeaderDate } from '../dates';

// Home: the control centre. What's now, what's next, a line for the day,
// and the numbers that matter, one screen, nothing else.
export default function HomeScreen({
  store,
  today,
  headerDate,
  forecast,
  art,
  quote,
  running,
  blockInfo,
  nextPick,
  openToday,
  doneToday,
  capacity,
  scratch,
  scratchActions,
  onStart,
  onFinish,
  onOpenTask,
  onJustOneThing,
  onGo,
  importProps,
  review,
}) {
  const now = useNow(!!running, 30000);
  const runs = useMemo(() => streaks(store, Date.now()).filter((s) => s.run > 0), [store.usage, store.days, store.routineDone, store.routineLog, store.routines]);
  const hour = new Date().getHours();
  const greeting = hour < 5 ? 'Still up' : hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const routinesWithGoal = (store.routines || []).filter((r) => r.minutesPerDay);

  return (
    <Screen>
      {art ? <Image source={{ uri: art.uri, headers: art.headers }} style={styles.art} resizeMode="cover" accessibilityLabel={art.name} /> : null}
      <Text style={styles.kicker}>{greeting}</Text>
      <Text style={styles.title}>{formatHeaderDate(headerDate)}</Text>
      <WeatherLine forecast={forecast} dayKey={today} isToday />

      {quote ? (
        <View style={styles.quote}>
          <Text style={styles.quoteText}>“{quote.text}”</Text>
          {quote.who || quote.show ? (
            <Text style={styles.quoteWho}>
              {quote.who}
              {quote.show ? ` · ${quote.show}` : ''}
            </Text>
          ) : null}
        </View>
      ) : null}

      {review?.show ? <ReviewCard tasks={review.tasks} tagFor={review.tagFor} onApply={review.onApply} onLater={review.onLater} /> : null}

      <View style={[shared.card, styles.now]}>
        {running ? (
          <View>
            <Text style={styles.nowKicker}>Now</Text>
            <Text style={styles.nowText}>{running.text}</Text>
            <Text style={styles.nowMeta}>
              {formatDuration(elapsedFor(running, now)) || '0m'} so far{running.estimateMs ? ` of ~${formatDuration(running.estimateMs)}` : ''}
            </Text>
            <View style={styles.row}>
              <PrimaryButton label="Finish" onPress={() => onFinish(running.id)} />
              <SmallButton label="Open" onPress={() => onOpenTask(running)} />
            </View>
          </View>
        ) : nextPick ? (
          <View>
            <Text style={styles.nowKicker}>{blockInfo?.current ? `${blockInfo.category?.name || 'Block'} time · ${describeBlockTime(blockInfo.current)}` : 'Next'}</Text>
            <Text style={styles.nowText}>{nextPick.text}</Text>
            {nextPick.firstStep ? <Text style={styles.nowMeta}>Start with: {nextPick.firstStep}</Text> : null}
            <View style={styles.row}>
              <PrimaryButton label="Start" onPress={() => onStart(nextPick.id)} />
              <SmallButton label="Something else" onPress={onJustOneThing} />
            </View>
          </View>
        ) : (
          <View>
            <Text style={styles.nowKicker}>Now</Text>
            <Text style={styles.nowText}>Nothing lined up.</Text>
            <Text style={styles.nowMeta}>Add one small thing on Today, or hold a thought below.</Text>
          </View>
        )}
      </View>

      <View style={styles.numbers}>
        <Stat value={doneToday} label="done today" />
        <Stat value={openToday} label="still open" />
        {capacity ? <Stat value={new Date(capacity.finishAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} label={capacity.over ? 'finish · past bed' : 'finish'} warn={capacity.over} /> : null}
        {routinesWithGoal.slice(0, 2).map((r) => (
          <Stat key={r.id} value={`${minutesToday(r.id, store.routineLog, new Date())}/${r.minutesPerDay}`} label={`${r.name} min`} />
        ))}
        {runs.slice(0, 2).map((s) => (
          <Stat key={s.id} value={`${s.run}d`} label={s.id === 'opened' ? 'in a row here' : s.id === 'bracketed' ? 'mornings in a row' : `${s.name} in a row`} />
        ))}
      </View>

      <ScratchCard scratch={scratch} {...scratchActions} />

      {importProps ? <ImportBox {...importProps} /> : null}

    </Screen>
  );
}

function Stat({ value, label, warn }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, warn && styles.statWarn]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function Link({ label, onPress }) {
  return (
    <TouchableOpacity style={styles.link} onPress={onPress} accessibilityRole="button">
      <Text style={styles.linkText}>{label} ›</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  art: { width: '100%', height: 160, borderRadius: 14, marginBottom: 14, backgroundColor: colors.accentSoft },
  kicker: { fontSize: 13, fontWeight: '600', letterSpacing: 1, textTransform: 'uppercase', color: colors.accent },
  title: { fontSize: 26, fontWeight: '700', color: colors.ink, marginTop: 4 },
  quote: { marginTop: 14, paddingLeft: 12, borderLeftWidth: 3, borderLeftColor: colors.accent },
  quoteText: { fontSize: 15, fontStyle: 'italic', color: colors.ink, lineHeight: 21 },
  quoteWho: { fontSize: 12, color: colors.muted, marginTop: 4 },
  now: { marginTop: 16 },
  nowKicker: { fontSize: 12, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', color: colors.accent },
  nowText: { fontSize: 20, fontWeight: '700', color: colors.ink, marginTop: 4 },
  nowMeta: { fontSize: 13, color: colors.muted, marginTop: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
  numbers: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  stat: { minWidth: 88, flexGrow: 1, padding: 10, borderRadius: 12, backgroundColor: colors.accentSoft },
  statValue: { fontSize: 20, fontWeight: '800', color: colors.accent },
  statWarn: { color: colors.warn },
  statLabel: { fontSize: 11, color: colors.muted, marginTop: 2 },
  links: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 20 },
  link: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: colors.line },
  linkText: { fontSize: 13, fontWeight: '600', color: colors.ink },
});
