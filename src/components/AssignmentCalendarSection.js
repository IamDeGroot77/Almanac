import { useEffect, useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { colors, shared } from '../theme';
import PersonChips from './PersonChips';
import { listWritableCalendars } from '../assignmentCalendar';

// Settings block: mirror Canvas assignments into a calendar of your choosing.
export default function AssignmentCalendarSection({ enabled, calendarId, onToggle, onPickCalendar, linkedCount, connected }) {
  const [calendars, setCalendars] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    listWritableCalendars()
      .then((list) => {
        setCalendars(list);
        if (!calendarId && list.length) onPickCalendar(list[0].id);
      })
      .catch((err) => setError(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={styles.section}>
      <View style={styles.row}>
        <Text style={styles.title}>Assignments on your calendar</Text>
        <Switch value={enabled} onValueChange={onToggle} disabled={!connected} />
      </View>
      <Text style={shared.muted}>
        {connected
          ? 'Puts each Canvas assignment on the calendar you pick, at its due time, and keeps it updated. Choose your Google account calendar and it shows up everywhere Google Calendar does.'
          : 'Connect Canvas first.'}
      </Text>
      {enabled && (
        <View>
          <Text style={styles.label}>Calendar</Text>
          {calendars.length === 0 ? (
            <Text style={shared.muted}>{error || 'No writable calendars found on this phone.'}</Text>
          ) : (
            <PersonChips
              people={calendars.map((c) => ({ id: c.id, name: c.owner && c.owner !== c.title ? `${c.title} (${c.owner})` : c.title }))}
              selected={calendarId}
              onSelect={onPickCalendar}
              compact
            />
          )}
          <Text style={styles.detail}>
            {linkedCount} assignment{linkedCount === 1 ? '' : 's'} on the calendar. Turning this off removes them.
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 32, paddingTop: 20, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  title: { fontSize: 15, fontWeight: '700', color: colors.ink, flex: 1, marginRight: 12 },
  label: { fontSize: 13, fontWeight: '600', color: colors.muted, marginTop: 12, marginBottom: 6 },
  detail: { fontSize: 12, color: colors.muted, marginTop: 8 },
});
