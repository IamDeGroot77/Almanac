import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';
import { PrimaryButton, SmallButton } from './Buttons';
import { formatTime } from '../dates';
import { formatDuration } from '../durations';
import EnergyPrompt from './EnergyPrompt';

const LONG_DAY_MS = 20 * 60 * 60 * 1000;
const REOPEN_WINDOW_MS = 4 * 60 * 60 * 1000;

// The day is bracketed by two taps rather than clock times. "I'm up" starts
// it and brings the start-of-day review; "Going to bed" opens the wrap-up.
// The started day stays "today" past midnight until Good night.
//
// Props:
//  openDay      { key, wokeAt } while a day is open, else null
//  pastMidnight true when the open day's date is behind the calendar
//  lastClosed   { key, sleptAt } most recently closed day, for Reopen
//  dayLabel     weekday name of the open day, e.g. "Wednesday"
export default function DayBracket({
  openDay,
  pastMidnight,
  lastClosed,
  dayLabel,
  leftovers,
  onStart,
  onBed,
  onReopen,
  onStartFresh,
  energy,
  onEnergy,
}) {
  const now = Date.now();

  if (!openDay) {
    const canReopen = lastClosed && now - lastClosed.sleptAt < REOPEN_WINDOW_MS;
    return (
      <View style={styles.card}>
        <Text style={styles.kicker}>Start of day</Text>
        <Text style={styles.title}>Good morning.</Text>
        <Text style={styles.sub}>
          {leftovers > 0
            ? `${leftovers} unfinished ${leftovers === 1 ? 'task' : 'tasks'} from before are waiting for a decision.`
            : "Tap when you're up and the day starts from now."}
        </Text>
        <View style={styles.row}>
          <PrimaryButton label="I'm up" onPress={onStart} />
          {canReopen ? <SmallButton label="Still up, reopen" onPress={() => onReopen(lastClosed.key)} /> : null}
        </View>
      </View>
    );
  }

  const awake = now - openDay.wokeAt;

  if (awake > LONG_DAY_MS && pastMidnight) {
    return (
      <View style={styles.card}>
        <Text style={styles.kicker}>Still {dayLabel}?</Text>
        <Text style={styles.title}>You've been up {formatDuration(awake)}.</Text>
        <Text style={styles.sub}>
          Close {dayLabel} first, or if you forgot to last night, start a fresh day now.
        </Text>
        <View style={styles.row}>
          <PrimaryButton label={`Going to bed`} onPress={onBed} />
          <SmallButton label="Start a new day" onPress={onStartFresh} />
        </View>
      </View>
    );
  }

  return (
    <View>
      <View style={styles.line}>
        <Text style={styles.lineText}>
          {pastMidnight ? `Still ${dayLabel} · ` : ''}Up since {formatTime(openDay.wokeAt)}
        </Text>
        <SmallButton label="Going to bed" onPress={onBed} />
      </View>
      {onEnergy && energy?.wake == null ? (
        <EnergyPrompt question="How's your energy this morning?" value={null} onSelect={(v) => onEnergy('wake', v)} compact />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: 20, padding: 16, borderRadius: 12, backgroundColor: colors.accentSoft },
  kicker: { fontSize: 12, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', color: colors.accent },
  title: { fontSize: 17, fontWeight: '700', color: colors.ink, marginTop: 4 },
  sub: { fontSize: 14, color: colors.muted, marginTop: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12 },
  line: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 },
  lineText: { fontSize: 13, color: colors.muted, flex: 1, marginRight: 10 },
});
