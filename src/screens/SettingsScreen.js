import { useEffect, useState } from 'react';
import { StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { geocode } from '../weather';
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
import { isWeb } from '../platform';
import DriveSection from '../components/DriveSection';

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
  weather,
  drive,
  onStageReview,
}) {
  // Appearance: stored outside the store because index.js reads it before anything loads.
  const [theme, setTheme] = useState('system');
  useEffect(() => {
    AsyncStorage.getItem('almanac:theme').then((v) => v && setTheme(v)).catch(() => {});
  }, []);
  const pickTheme = (v) => {
    setTheme(v);
    AsyncStorage.setItem('almanac:theme', v).catch(() => {});
  };
  // Weather place lookup.
  const [placeQuery, setPlaceQuery] = useState('');
  const [placeOptions, setPlaceOptions] = useState([]);
  const [placeError, setPlaceError] = useState(null);
  const lookupPlace = async () => {
    setPlaceError(null);
    try {
      const results = await geocode(placeQuery);
      setPlaceOptions(results);
      if (results.length === 0) setPlaceError('No match. Try a city name or postcode.');
    } catch (err) {
      setPlaceError(err.message);
    }
  };
  const version = Constants.expoConfig?.version || '';
  const lastSleep = sleep.segments.length ? sleep.segments[sleep.segments.length - 1] : null;
  const focusApps = [{ id: null, name: 'None' }, ...APP_CATALOG.filter((a) => a.kind === 'focus')];
  const timerApps = [{ id: null, name: 'None' }, ...APP_CATALOG.filter((a) => a.kind === 'timer')];

  return (
    <Screen>
      <Text style={styles.title}>Settings</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Appearance</Text>
        <PersonChips
          people={[
            { id: 'system', name: 'Match phone' },
            { id: 'light', name: 'Light' },
            { id: 'dark', name: 'Dark' },
          ]}
          selected={theme}
          onSelect={pickTheme}
          compact
        />
        <Text style={styles.detail}>Takes effect the next time the app opens.</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Weather and daylight</Text>
        {prefs.weatherPlace ? (
          <View>
            <Text style={shared.muted}>Showing weather for {prefs.weatherPlace.name}.</Text>
            <SmallButton label="Change place" onPress={() => onSetPref('weatherPlace', null)} />
          </View>
        ) : (
          <View>
            <Text style={shared.muted}>Type a city or postcode and pick a match. Free, no account.</Text>
            <View style={styles.inputRow}>
              <TextInput
                style={[shared.input, styles.input]}
                value={placeQuery}
                onChangeText={setPlaceQuery}
                placeholder="e.g. Oshkosh or 54901"
                placeholderTextColor={colors.muted}
                returnKeyType="search"
                onSubmitEditing={lookupPlace}
              />
              <SmallButton label="Find" onPress={lookupPlace} />
            </View>
            {placeOptions.map((p) => (
              <SmallButton key={`${p.lat},${p.lon}`} label={p.name} onPress={() => onSetPref('weatherPlace', p)} style={styles.option} />
            ))}
            {placeError ? <Text style={styles.error}>{placeError}</Text> : null}
          </View>
        )}
        {weather?.error ? <Text style={styles.error}>{weather.error}</Text> : null}
      </View>

      {isWeb ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>On the phone</Text>
          <Text style={shared.muted}>
            Reminders, voice quick add, energy checks, check-ins, sleep detection, hand-off apps, Canvas,
            and calendar mirroring run on the phone. This laptop gets their results through sync.
          </Text>
        </View>
      ) : (
        <>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Morning brief</Text>
        <Text style={shared.muted}>{reminderMessage(reminderStatus) || 'Checking your alarm…'}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Bedtime nudge</Text>
        <Text style={shared.muted}>
          A notification with "Going to bed" and "Not yet" buttons, so closing the day is one tap from the
          shade or the watch. Not yet asks again in half an hour.
        </Text>
        <PersonChips
          people={[
            { id: '-1', name: 'Off' },
            { id: '21', name: '9 PM' },
            { id: '22', name: '10 PM' },
            { id: '23', name: '11 PM' },
            { id: '0', name: 'Midnight' },
            { id: '1', name: '1 AM' },
          ]}
          selected={String(prefs.bedtimeHour ?? 23)}
          onSelect={(id) => onSetPref('bedtimeHour', Number(id))}
          compact
        />
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
        <View style={styles.switchRow}>
          <Text style={styles.sectionTitle}>Sunday letter</Text>
          <Switch value={prefs.weeklyLetter !== false} onValueChange={(v) => onSetPref('weeklyLetter', v)} />
        </View>
        <Text style={shared.muted}>
          A Sunday 6 PM note that the week's letter is ready on the Insights tab: what got done, what
          slipped, how estimates held up.
        </Text>
      </View>

      <View style={styles.section}>
        <View style={styles.switchRow}>
          <Text style={styles.sectionTitle}>Midday energy check</Text>
          <Switch value={prefs.energyCheckins !== false} onValueChange={(v) => onSetPref('energyCheckins', v)} />
        </View>
        <Text style={shared.muted}>
          A 1 PM notification asking how your energy is, answered with one tap. Morning and evening
          checks are on the Today screen. Insights compares energy with what got done.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Check-ins while a task runs</Text>
        <Text style={shared.muted}>
          Every so often the phone asks "Still working on this?" with Still on it, Pause, and Finish
          buttons. They work from the shade and the watch.
        </Text>
        <PersonChips
          people={[
            { id: '0', name: 'Off' },
            { id: '15', name: '15 min' },
            { id: '30', name: '30 min' },
            { id: '45', name: '45 min' },
            { id: '60', name: '1 hour' },
          ]}
          selected={String(prefs.checkinMinutes ?? 30)}
          onSelect={(id) => onSetPref('checkinMinutes', Number(id))}
          compact
        />
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

        <Text style={[styles.sectionTitle, styles.subTitle]}>From the watch (Health Connect)</Text>
        {sleep.health.status === 'missing' ? (
          <Text style={shared.muted}>Needs a newer app build.</Text>
        ) : sleep.health.status !== 'available' ? (
          <Text style={shared.muted}>
            {sleep.health.status === 'update'
              ? 'Health Connect needs an update on this phone (it is in the Play Store).'
              : 'Health Connect is not available on this phone.'}
          </Text>
        ) : sleep.health.enabled ? (
          <View>
            <Text style={shared.muted}>
              On. Sleep recorded by your Galaxy Watch through Samsung Health is read from Health Connect and
              takes priority over the phone's guess.
            </Text>
            <Text style={styles.detail}>
              {sleep.health.lastRead
                ? `Latest: asleep ${formatTime(sleep.health.lastRead.start)} to ${formatTime(sleep.health.lastRead.end)} (${formatDuration(sleep.health.lastRead.end - sleep.health.lastRead.start)}).`
                : 'No sessions read yet. Make sure Samsung Health is set to sync sleep to Health Connect.'}
            </Text>
            <SmallButton label="Turn off" onPress={sleep.health.disable} style={styles.button} />
          </View>
        ) : (
          <View>
            <Text style={shared.muted}>
              Use the sleep your watch records. In Samsung Health, turn on syncing to Health Connect, then
              allow Almanac to read sleep.
            </Text>
            <SmallButton label="Connect Health Connect" onPress={sleep.health.enable} style={styles.button} />
          </View>
        )}
        {sleep.health.error ? <Text style={styles.error}>{sleep.health.error}</Text> : null}
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

        </>
      )}

      <DriveSection auth={google} drive={drive} />

      {!isWeb && (
        <>
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

        </>
      )}

      {__DEV__ && !isWeb && <DevSection onStageReview={onStageReview} />}

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
  subTitle: { marginTop: 18 },
  label: { fontSize: 13, fontWeight: '600', color: colors.muted, marginTop: 12, marginBottom: 6 },
  button: { marginTop: 10 },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  input: { flex: 1 },
  option: { marginTop: 8 },
  error: { color: colors.danger, fontSize: 13, marginTop: 6 },
  footer: { marginTop: 32, fontSize: 13, color: colors.muted, textAlign: 'center' },
});
