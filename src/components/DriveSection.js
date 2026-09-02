import { StyleSheet, Text, View } from 'react-native';
import { colors, shared } from '../theme';
import { PrimaryButton, SmallButton } from './Buttons';
import { isWeb } from '../platform';

function describeLastSync(ts) {
  if (!ts) return 'Not synced yet.';
  const mins = Math.round((Date.now() - ts) / 60000);
  if (mins < 1) return 'Synced just now.';
  if (mins < 60) return `Synced ${mins} min ago.`;
  const hours = Math.round(mins / 60);
  return hours < 24 ? `Synced ${hours} hour${hours === 1 ? '' : 's'} ago.` : `Synced on ${new Date(ts).toLocaleDateString()}.`;
}

// Phone <-> laptop sync through a private file in Google Drive.
export default function DriveSection({ auth, drive }) {
  return (
    <View style={styles.section}>
      <Text style={styles.title}>Phone and laptop sync</Text>

      {!auth.configured && (
        <Text style={shared.muted}>
          {isWeb
            ? 'Not set up yet: the web sign-in client ID is missing from app.json.'
            : 'Not set up yet. Add the Google client ID to app.json.'}
        </Text>
      )}

      {auth.configured && !auth.account && (
        <View>
          <Text style={shared.muted}>
            Sign in with the same Google account on each device. Almanac keeps one private file in your
            Drive's app storage and merges every device into it. Nobody else can see it.
          </Text>
          <PrimaryButton label="Sign in with Google" onPress={auth.signIn} style={styles.connect} />
          {auth.error ? <Text style={styles.error}>{auth.error}</Text> : null}
        </View>
      )}

      {auth.configured && auth.account && (
        <View>
          <Text style={shared.muted}>Signed in as {auth.account}.</Text>
          <Text style={[shared.muted, drive.state === 'error' && styles.error]}>
            {drive.state === 'syncing' ? 'Syncing…' : drive.state === 'error' ? `Sync failed: ${drive.error}` : describeLastSync(drive.lastSyncAt)}
          </Text>
          <View style={shared.row}>
            <SmallButton label="Sync now" onPress={drive.syncNow} />
            <SmallButton label="Sign out" onPress={auth.signOut} />
          </View>
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
});
