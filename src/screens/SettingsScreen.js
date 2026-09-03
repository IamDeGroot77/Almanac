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
import CalendarRulesSection from '../components/CalendarRulesSection';
import DayPlanSection from '../components/DayPlanSection';
import DopamenuSection from '../components/DopamenuSection';
import Collapsible from '../components/Collapsible';
import DropBoxSection from '../components/DropBoxSection';

// Settings in five groups, each one line until opened: Look and feel, Your
// day, Sleep, Connections, People. The laptop shows only what runs there.
export default function SettingsScreen({
  google,
  sync,
  reminderStatus,
  people,
  onAddPerson,
  sleep,
  prefs,
  onSetPref,
  lists = [],
  categories = [],
  onAddCategory,
  onRenameCategory,
  onDeleteCategory,
  canvas,
  canvasSync,
  canvasCourses,
  onToggleAssignmentCalendar,
  linkedEventCount,
  onStageReview,
  weather,
  drive,
  embedded = false,
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
  const [quotesText, setQuotesText] = useState(prefs.quotes || '');
  useEffect(() => setQuotesText(prefs.quotes || ''), [prefs.quotes]);
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
  const lastSleep = sleep?.segments?.length ? sleep.segments[sleep.segments.length - 1] : null;
  const focusApps = [{ id: null, name: 'None' }, ...APP_CATALOG.filter((a) => a.kind === 'focus')];
  const timerApps = [{ id: null, name: 'None' }, ...APP_CATALOG.filter((a) => a.kind === 'timer')];
  const themeName = { system: 'Match phone', light: 'Light', dark: 'Dark', anime: 'Anime' }[theme] || theme;
  const connectionsAlert = google.account && (drive?.state === 'reconnect' || drive?.state === 'error' || sync?.state === 'error');
  const connectionsSummary = !google.account ? 'Google not connected' : connectionsAlert ? 'Google needs attention' : `Google · ${google.account}${!isWeb && canvas?.connected ? ' · Canvas' : ''}`;
  const daySummary = isWeb
    ? `${categories.length} ${categories.length === 1 ? 'category' : 'categories'} · ${(prefs.dayBlocks || []).length} ${(prefs.dayBlocks || []).length === 1 ? 'block' : 'blocks'}`
    : `Brief, bedtime ${prefs.bedtimeHour === -1 ? 'off' : `at ${formatTime(new Date().setHours(prefs.bedtimeHour ?? 23, 0, 0, 0))}`}, ${(prefs.dayBlocks || []).length} ${(prefs.dayBlocks || []).length === 1 ? 'block' : 'blocks'}`;
  const sleepSummary = !sleep?.available ? 'Needs the newer build' : sleep.enabled || sleep.health?.enabled ? `On${sleep.health?.enabled ? ', with the watch' : ''}` : 'Off';

  const Wrap = embedded ? View : Screen;

  return (
    <Wrap>
      {!embedded ? <Text style={styles.title}>Settings</Text> : null}

      <Collapsible title="Look and feel" summary={`${themeName}${prefs.weatherPlace ? ` · weather for ${prefs.weatherPlace.name}` : ''}`}>
        <Text style={styles.label}>Appearance</Text>
        <PersonChips
          people={[
            { id: 'system', name: 'Match phone' },
            { id: 'light', name: 'Light' },
            { id: 'dark', name: 'Dark' },
            { id: 'anime', name: 'Anime' },
          ]}
          selected={theme}
          onSelect={pickTheme}
          compact
        />
        <Text style={styles.detail}>Takes effect the next time the app opens.</Text>

        <Text style={styles.label}>Quotes and art</Text>
        <Text style={shared.muted}>
          Home shows a line for the day. Add your own, one per line, as "quote — who, show". Yours come up three times
          as often as the built-in set. For pictures, drop images named art-something.jpg into the Files tab on the
          laptop; one rotates onto Home each day.
        </Text>
        <TextInput
          style={[shared.input, styles.quotesBox]}
          multiline
          value={quotesText}
          onChangeText={setQuotesText}
          onBlur={() => onSetPref('quotes', quotesText)}
          placeholder={'Set your heart ablaze. — Rengoku, Demon Slayer'}
          placeholderTextColor={colors.muted}
        />

        <Text style={styles.label}>Weather and daylight</Text>
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
      </Collapsible>

      <Collapsible title="Your day" summary={daySummary}>
        {!isWeb ? (
          <View>
            <Text style={styles.label}>Morning brief</Text>
            <Text style={shared.muted}>{reminderMessage(reminderStatus) || 'Checking your alarm…'}</Text>

            <Text style={styles.label}>Bedtime nudge</Text>
            <Text style={shared.muted}>"Going to bed" and "Not yet" buttons in a notification, so closing the day is one tap. Not yet asks again in half an hour.</Text>
            <PersonChips
              people={[
                { id: '-1', name: 'Off' },
                { id: '21', name: '9 PM' },
                { id: '22', name: '10 PM' },
                { id: '23', name: '11 PM' },
                { id: '0', name: 'Midnight' },
                { id: '1', name: '1 AM' },
                { id: '2', name: '2 AM' },
                { id: '3', name: '3 AM' },
              ]}
              selected={String(prefs.bedtimeHour ?? 23)}
              onSelect={(id) => onSetPref('bedtimeHour', Number(id))}
              compact
            />
          </View>
        ) : null}

        <DayPlanSection
          categories={categories}
          lists={lists}
          blocks={prefs.dayBlocks || []}
          onAddCategory={onAddCategory}
          onRenameCategory={onRenameCategory}
          onDeleteCategory={onDeleteCategory}
          onSetBlocks={(blocks) => onSetPref('dayBlocks', blocks)}
        />

        <DopamenuSection menu={prefs.dopamenu || []} onChange={(menu) => onSetPref('dopamenu', menu)} />

        {!isWeb ? (
          <View>
            <View style={styles.switchRow}>
              <Text style={styles.label}>Midday energy check</Text>
              <Switch value={prefs.energyCheckins !== false} onValueChange={(v) => onSetPref('energyCheckins', v)} />
            </View>
            <Text style={shared.muted}>A 1 PM notification asking how your energy is, answered with one tap.</Text>

            <Text style={styles.label}>Check-ins while a task runs</Text>
            <Text style={shared.muted}>"Still working on this?" with Still on it, Pause, and Finish, from the shade and the watch.</Text>
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

            <View style={styles.switchRow}>
              <Text style={styles.label}>Quick add from the shade and watch</Text>
              <Switch value={!!prefs.quickAddNotification} onValueChange={(v) => onSetPref('quickAddNotification', v)} />
            </View>
            <Text style={shared.muted}>Keeps a notification in the shade with Speak a task, Hold a thought, and Journal. On a Galaxy Watch you answer by voice.</Text>

            <View style={styles.switchRow}>
              <Text style={styles.label}>Sunday letter</Text>
              <Switch value={prefs.weeklyLetter !== false} onValueChange={(v) => onSetPref('weeklyLetter', v)} />
            </View>
            <Text style={shared.muted}>A Sunday 6 PM note that the week's letter is ready, with one question that files into the journal.</Text>
          </View>
        ) : (
          <Text style={[shared.muted, styles.note]}>Reminders, energy checks, check-ins, and voice capture run on the phone.</Text>
        )}
      </Collapsible>

      {!isWeb && sleep ? (
        <Collapsible title="Sleep" summary={sleepSummary}>
          <Text style={styles.label}>Sleep detection</Text>
          {!sleep.available ? (
            <Text style={shared.muted}>Needs a newer app build. Install the latest APK to turn this on.</Text>
          ) : sleep.enabled ? (
            <View>
              <Text style={shared.muted}>On. The phone notices when it goes still for the night and uses that to fill in a forgotten Good night or I'm up.</Text>
              <Text style={styles.detail}>
                {lastSleep
                  ? `Last detected: asleep ${formatTime(lastSleep.start)} to ${formatTime(lastSleep.end)} (${formatDuration(lastSleep.end - lastSleep.start)}).`
                  : 'Nothing detected yet. The first reading usually arrives the morning after enabling.'}
              </Text>
              <SmallButton label="Turn off" onPress={sleep.disable} style={styles.button} />
            </View>
          ) : (
            <View>
              <Text style={shared.muted}>Let the phone's own sleep detection fill in bedtime and wake time when you forget to tap. Android asks for the physical activity permission.</Text>
              <SmallButton label="Turn on" onPress={sleep.enable} style={styles.button} />
            </View>
          )}
          {sleep.error ? <Text style={styles.error}>{sleep.error}</Text> : null}

          <Text style={styles.label}>From the watch (Health Connect)</Text>
          {sleep.health.status === 'missing' ? (
            <Text style={shared.muted}>Needs a newer app build.</Text>
          ) : sleep.health.status !== 'available' ? (
            <Text style={shared.muted}>{sleep.health.status === 'update' ? 'Health Connect needs an update on this phone (it is in the Play Store).' : 'Health Connect is not available on this phone.'}</Text>
          ) : sleep.health.enabled ? (
            <View>
              <Text style={shared.muted}>On. Sleep recorded by your Galaxy Watch through Samsung Health takes priority over the phone's guess.</Text>
              <Text style={styles.detail}>
                {sleep.health.lastRead
                  ? `Latest: asleep ${formatTime(sleep.health.lastRead.start)} to ${formatTime(sleep.health.lastRead.end)} (${formatDuration(sleep.health.lastRead.end - sleep.health.lastRead.start)}).`
                  : 'No sessions read yet. Make sure Samsung Health is set to sync sleep to Health Connect.'}
              </Text>
              <SmallButton label="Turn off" onPress={sleep.health.disable} style={styles.button} />
            </View>
          ) : (
            <View>
              <Text style={shared.muted}>Use the sleep your watch records. In Samsung Health, turn on syncing to Health Connect, then allow Almanac to read sleep.</Text>
              <SmallButton label="Connect Health Connect" onPress={sleep.health.enable} style={styles.button} />
            </View>
          )}
          {sleep.health.error ? <Text style={styles.error}>{sleep.health.error}</Text> : null}
        </Collapsible>
      ) : null}

      <Collapsible title="Connections" summary={connectionsSummary} alert={!!connectionsAlert} open={!!connectionsAlert}>
        <GoogleSection auth={google} sync={sync} drive={drive} />
        {!isWeb ? (
          <View>
            <CanvasSection auth={canvas} sync={canvasSync} courses={canvasCourses} />
            <AssignmentCalendarSection
              connected={canvas.connected}
              enabled={!!prefs.assignmentsToCalendar}
              calendarId={prefs.assignmentCalendarId}
              onToggle={onToggleAssignmentCalendar}
              onPickCalendar={(id) => onSetPref('assignmentCalendarId', id)}
              linkedCount={linkedEventCount}
            />
            <CalendarRulesSection rules={prefs.calendarRules || []} lists={lists} onChange={(rules) => onSetPref('calendarRules', rules)} />
            <DropBoxSection google={google} />
            <Text style={styles.label}>Hand-off apps</Text>
            <Text style={shared.muted}>When you start a phone-free task or a timed routine item, Almanac opens one of these.</Text>
            <Text style={styles.subLabel}>Focus app</Text>
            <PersonChips people={focusApps.map((a) => ({ id: a.id ?? 'none', name: a.name }))} selected={prefs.focusApp ?? 'none'} onSelect={(id) => onSetPref('focusApp', id === 'none' ? null : id)} compact />
            <Text style={styles.subLabel}>Timer app</Text>
            <PersonChips people={timerApps.map((a) => ({ id: a.id ?? 'none', name: a.name }))} selected={prefs.timerApp ?? 'none'} onSelect={(id) => onSetPref('timerApp', id === 'none' ? null : id)} compact />
          </View>
        ) : (
          <Text style={[shared.muted, styles.note]}>Canvas, calendar mirroring, and hand-off apps are set up on the phone.</Text>
        )}
      </Collapsible>

      <Collapsible title="People" summary={people.map((p) => p.name).join(', ')}>
        <Text style={shared.muted}>Tasks and lists can be tagged for any of these.</Text>
        <PersonChips people={people} selected={null} onSelect={() => {}} onAdd={onAddPerson} compact />
      </Collapsible>

      {!isWeb ? (
        <Collapsible title="Developer" summary={prefs.listsDiag ? 'Lists step-by-step is on' : 'Test buttons'} open={!!prefs.listsDiag}>
          <View style={styles.switchRow}>
            <Text style={styles.label}>Lists tab, step by step</Text>
            <Switch value={!!prefs.listsDiag} onValueChange={(v) => onSetPref('listsDiag', v)} />
          </View>
          <Text style={shared.muted}>For finding a crash: the Lists tab shows one part at a time with a button to reveal the next. The last part shown before a crash is the culprit.</Text>
          {__DEV__ ? <DevSection onStageReview={onStageReview} /> : null}
        </Collapsible>
      ) : null}

      <Text style={styles.footer}>Almanac {version}</Text>
    </Wrap>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 26, fontWeight: '700', color: colors.ink },
  label: { fontSize: 14, fontWeight: '700', color: colors.ink, marginTop: 16, marginBottom: 6 },
  subLabel: { fontSize: 13, fontWeight: '600', color: colors.muted, marginTop: 10, marginBottom: 6 },
  quotesBox: { flex: 0, minHeight: 90, textAlignVertical: 'top', marginTop: 4 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  detail: { fontSize: 13, color: colors.muted, marginTop: 4 },
  note: { marginTop: 8 },
  button: { marginTop: 10 },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  input: { flex: 1 },
  option: { marginTop: 8 },
  error: { color: colors.danger, fontSize: 13, marginTop: 6 },
  footer: { marginTop: 32, fontSize: 13, color: colors.muted, textAlign: 'center' },
});
