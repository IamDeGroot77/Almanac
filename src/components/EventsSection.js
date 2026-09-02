import { Linking, StyleSheet, Text, View } from 'react-native';
import { SmallButton } from './Buttons';
import { colors, shared } from '../theme';

export default function EventsSection({ status, events, calendarNames = [], onRetry }) {
  return (
    <View style={styles.section}>
      <Text style={styles.title}>Events</Text>

      {status === 'loading' && <Text style={shared.muted}>Loading your calendar…</Text>}
      {status === 'unavailable' && <Text style={shared.muted}>Calendar events show on the phone.</Text>}

      {status === 'denied' && (
        <View>
          <Text style={shared.muted}>Almanac needs calendar access to show your events.</Text>
          <View style={shared.row}>
            <SmallButton label="Try again" onPress={onRetry} />
            <SmallButton label="Open Settings" onPress={() => Linking.openSettings()} />
          </View>
        </View>
      )}

      {status === 'error' && (
        <View>
          <Text style={shared.muted}>Couldn't read your calendar.</Text>
          <SmallButton label="Try again" onPress={onRetry} />
        </View>
      )}

      {status === 'granted' && events.length === 0 && (
        <View>
          <Text style={shared.muted}>Nothing on the calendar.</Text>
          <Text style={styles.detail}>
            {calendarNames.length === 0
              ? 'No calendars found on this phone.'
              : `Checked ${calendarNames.length}: ${calendarNames.join(', ')}`}
          </Text>
        </View>
      )}

      {status === 'granted' &&
        events.map((e) => (
          <View key={e.id} style={[styles.eventRow, shared.hairline]}>
            <Text style={styles.eventTime}>{e.time}</Text>
            <View style={styles.eventBody}>
              <Text style={styles.eventTitle}>{e.title}</Text>
              {e.location ? <Text style={styles.eventLocation}>{e.location}</Text> : null}
            </View>
          </View>
        ))}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 28 },
  title: { fontSize: 18, fontWeight: '700', color: colors.ink, marginBottom: 10 },
  eventRow: { flexDirection: 'row', paddingVertical: 10 },
  eventTime: { width: 80, fontSize: 14, color: colors.muted, paddingTop: 2 },
  eventBody: { flex: 1 },
  eventTitle: { fontSize: 16, color: colors.ink },
  eventLocation: { fontSize: 13, color: colors.muted, marginTop: 2 },
  detail: { fontSize: 12, color: colors.muted },
});
