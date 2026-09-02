import { StyleSheet, Text, View } from 'react-native';
import { PrimaryButton, SmallButton } from './Buttons';
import { colors, shared } from '../theme';
import { isWeb } from '../platform';

function describeLastSync(ts) {
  if (!ts) return 'not synced yet';
  const mins = Math.round((Date.now() - ts) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  return hours < 24 ? `${hours} hour${hours === 1 ? '' : 's'} ago` : `on ${new Date(ts).toLocaleDateString()}`;
}

function line(label, s) {
  if (!s) return null;
  if (s.state === 'syncing') return { text: `${label}: syncing…` };
  if (s.state === 'reconnect') return { text: `${label}: ${s.error}`, error: true };
  if (s.state === 'error') return { text: `${label}: failed. ${s.error}`, error: true };
  return { text: `${label}: synced ${describeLastSync(s.lastSyncAt)}.` };
}

// One Google connection for everything: Tasks lists (phone), the private
// Drive file that keeps phone and laptop in step, the drop box, and the
// laptop's calendar. One button, one status.
export default function GoogleSection({ auth, sync, drive }) {
  const lines = [isWeb ? null : line('Tasks', sync), line('Devices', drive)].filter(Boolean);
  const syncAll = () => {
    sync?.syncNow?.();
    drive?.syncNow?.();
  };
  return (
    <View style={styles.section}>
      <Text style={styles.title}>Google</Text>

      {!auth.configured && (
        <Text style={shared.muted}>{isWeb ? 'Not set up yet: the web sign-in client ID is missing from app.json.' : 'Not set up yet. Add the Google client ID to app.json (see GOOGLE_SETUP.md).'}</Text>
      )}

      {auth.configured && !auth.account && (
        <View>
          <Text style={shared.muted}>
            One sign-in covers everything: your named lists sync with Google Tasks, so anything you tell Gemini to add
            shows up here; phone and laptop stay in step through a private file in your Drive; the Files drop box and
            the laptop calendar use the same account. Sign in with the same Google account on each device.
          </Text>
          <PrimaryButton label="Connect Google" onPress={auth.signIn} style={styles.connect} />
          {auth.error ? <Text style={styles.error}>{auth.error}</Text> : null}
        </View>
      )}

      {auth.configured && auth.account && (
        <View>
          <Text style={shared.muted}>Connected as {auth.account}.</Text>
          {lines.map((l) => (
            <Text key={l.text} style={[shared.muted, l.error && styles.errorLine]}>
              {l.text}
            </Text>
          ))}
          <View style={shared.row}>
            <SmallButton label="Sync now" onPress={syncAll} />
            <SmallButton label="Disconnect" onPress={auth.signOut} />
          </View>
          {lines.some((l) => l.error) ? (
            <Text style={styles.hint}>If it says Google needs connecting again: Disconnect, then Connect, and accept both Tasks and Drive on Google's screen.</Text>
          ) : null}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 32, paddingTop: 20, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  title: { fontSize: 15, fontWeight: '700', color: colors.ink, marginBottom: 6 },
  connect: { alignSelf: 'flex-start', marginTop: 4 },
  error: { color: colors.danger, fontSize: 13, marginTop: 6 },
  errorLine: { color: colors.danger },
  hint: { fontSize: 12, color: colors.muted, marginTop: 8 },
});
