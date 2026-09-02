import { StyleSheet, Switch, Text, View } from 'react-native';
import Constants from 'expo-constants';
import { colors, shared } from '../theme';
import Screen from '../components/Screen';
import GoogleSection from '../components/GoogleSection';
import CanvasSection from '../components/CanvasSection';
import AssignmentCalendarSection from '../components/AssignmentCalendarSection';
import DevSection from '../components/DevSection';
import PersonChips from '../components/PersonChips';
import { SmallButton } from '../components/Buttons';
import { reminderMessage } from '../notifications';
import { APP_CATALOG } from '../apps';
import { formatDuration } from '../durations';
import { formatTime } from '../dates';

export default function SettingsScreen({
  google,
  sync,
  reminderStatus,
  people,
  onAddPerson,
  sleep,
  prefs,
  onSetPref,
  canvas,
  canvasSync,
  canvasCourses,
  onToggleAssignmentCalendar,
  linkedEventCount,
  onStageReview,
}) {
  const version = Constants.expoConfig?.version || '';
  const lastSleep = sleep.segments.length ? sleep.segments[sleep.segments.length - 1] : null;
  const focusApps = [{ id: null, name: 'None' }, ...APP_CATALOG.filter((a) => a.kind === 'focus')];
  const timerApps = [{ id: null, name: 'None' }, ...APP_CATALOG.filter((a) => a.kind === 'timer')];

  return (
    <Screen>
      <Text style={styles.title}>Settings</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Daily brief</Text>
        <Text style={shared.muted}>{reminderMessage(reminderStatus) || 'Setting up the 6:30 AM reminder…'}</Text>
      </View>

      <View style={styles.section}>
        <View style={styles.switchRow}>
          <Text style={styles.sectionTitle}>Quick add from the shade and watch</Text>
          <Switch value={!!prefs.quickAddNotification} onValueChange={(v) => onSetPref('quickAddNotification', v)} />
        </View>
        <Text style={shared.muted}>
          Keeps an Almanac notification in the shade with "Speak a task" and "Speak a note". On a Galaxy
          Watch or any Wear OS watch you can answer by voice. Say things like "milk to groceries",
          "call the dentist tomorrow", or "sign the form for Zeke".
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Sleep detection</Text>
        {!sleep.available ? (
          <Text style={shared.muted}>Needs a newer app build. Install the latest APK to turn this on.</Text>
        ) : sleep.enabled ? (
          <View>
            <Text style={shared.muted}>
              On. The phone notices when it goes still for the night and Almanac uses that to fill in a
              forgotten Good night or I'm up.
            </Text>
            <Text style={styles.detail}>
              {lastSleep
                ? `Last detected: asleep ${formatTime(lastSleep.start)} to ${formatTime(lastSleep.end)} (${formatDuration(lastSleep.end - lastSleep.start)}).`
                : 'Nothing detected yet. The first reading usually arrives the morning after enabling.'}
            </Text>
            <SmallButton label="Turn off" onPress={sleep.disable} style={styles.button} />
          </View>
        ) : (
          <View>
            <Text style={shared.muted}>
              Let the phone's own sleep detection fill in bedtime and wake time when you forget to tap.
              No wearable needed. Android will ask for the physical activity permission.
            </Text>
            <SmallButton label="Turn on" onPress={sleep.enable} style={styles.button} />
          </View>
        )}
        {sleep.error ? <Text style={styles.error}>{sleep.error}</Text> : null}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Hand-off apps</Text>
        <Text style={shared.muted}>
          When you start a phone-free task, the Focus screen offers to open one of these.
        </Text>
        <Text style={styles.label}>Focus app</Text>
        <PersonChips
          people={focusApps.map((a) => ({ id: a.id ?? 'none', name: a.name }))}
          selected={prefs.focusApp ?? 'none'}
          onSelect={(id) => onSetPref('focusApp', id === 'none' ? null : id)}
          compact
        />
        <Text style={styles.label}>Timer app</Text>
        <PersonChips
          people={timerApps.map((a) => ({ id: a.id ?? 'none', name: a.name }))}
          selected={prefs.timerApp ?? 'none'}
          onSelect={(id) => onSetPref('timerApp', id === 'none' ? null : id)}
          compact
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>People</Text>
        <Text style={shared.muted}>Tasks and lists can be tagged for any of these.</Text>
        <PersonChips people={people} selected={null} onSelect={() => {}} onAdd={onAddPerson} compact />
      </View>

      <GoogleSection auth={google} sync={sync} />

      <CanvasSection auth={canvas} sync={canvasSync} courses={canvasCourses} />

      <AssignmentCalendarSection
        connected={canvas.connected}
        enabled={!!prefs.assignmentsToCalendar}
        calendarId={prefs.assignmentCalendarId}
        onToggle={onToggleAssignmentCalendar}
        onPickCalendar={(id) => onSetPref('assignmentCalendarId', id)}
        linkedCount={linkedEventCount}
      />

      {__DEV__ && <DevSection onStageReview={onStageReview} />}

      <Text style={styles.footer}>Almanac {version}</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 26, fontWeight: '700', color: colors.ink },
  section: { marginTop: 28, paddingTop: 20, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.ink, marginBottom: 6 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  detail: { fontSize: 13, color: colors.muted, marginTop: 4 },
  label: { fontSize: 13, fontWeight: '600', color: colors.muted, marginTop: 12, marginBottom: 6 },
  button: { marginTop: 10 },
  error: { color: colors.danger, fontSize: 13, marginTop: 6 },
  footer: { marginTop: 32, fontSize: 13, color: colors.muted, textAlign: 'center' },
});
