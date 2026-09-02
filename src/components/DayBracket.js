import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';
import { PrimaryButton, SmallButton } from './Buttons';
import { formatTime } from '../dates';
import { formatDuration } from '../durations';

// The day is bracketed by two taps rather than clock times:
// "I'm up" starts it (and brings the start-of-day review), "Going to bed"
// opens the wrap-up and ends it.
export default function DayBracket({ day, leftovers, onStart, onBed, onReopen }) {
  if (!day?.wokeAt) {
    return (
      <View style={styles.card}>
        <Text style={styles.kicker}>Start of day</Text>
        <Text style={styles.title}>Good morning.</Text>
        <Text style={styles.sub}>
          {leftovers > 0
            ? `${leftovers} unfinished ${leftovers === 1 ? 'task' : 'tasks'} from before are waiting for a decision.`
            : "Tap when you're up and the day starts from now."}
        </Text>
        <PrimaryButton label="I'm up" onPress={onStart} style={styles.button} />
      </View>
    );
  }

  if (day.sleptAt) {
    return (
      <View style={styles.line}>
        <Text style={styles.lineText}>
          Day wrapped up at {formatTime(day.sleptAt)} · awake {formatDuration(day.sleptAt - day.wokeAt)}
        </Text>
        <SmallButton label="Reopen" onPress={onReopen} />
      </View>
    );
  }

  return (
    <View style={styles.line}>
      <Text style={styles.lineText}>Up since {formatTime(day.wokeAt)}</Text>
      <SmallButton label="Going to bed" onPress={onBed} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: 20, padding: 16, borderRadius: 12, backgroundColor: colors.accentSoft },
  kicker: { fontSize: 12, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', color: colors.accent },
  title: { fontSize: 17, fontWeight: '700', color: colors.ink, marginTop: 4 },
  sub: { fontSize: 14, color: colors.muted, marginTop: 2 },
  button: { alignSelf: 'flex-start', marginTop: 12 },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  lineText: { fontSize: 13, color: colors.muted, flex: 1, marginRight: 10 },
});
