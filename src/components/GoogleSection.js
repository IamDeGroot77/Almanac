import { StyleSheet, Text, View } from 'react-native';
import { PrimaryButton, SmallButton } from './Buttons';
import { colors, shared } from '../theme';

function describeLastSync(ts) {
  if (!ts) return 'Not synced yet.';
  const mins = Math.round((Date.now() - ts) / 60000);
  if (mins < 1) return 'Synced just now.';
  if (mins < 60) return `Synced ${mins} min ago.`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `Synced ${hours} hour${hours === 1 ? '' : 's'} ago.`;
  return `Synced on ${new Date(ts).toLocaleDateString()}.`;
}

export default function GoogleSection({ auth, sync }) {
  return (
    <View style={styles.section}>
      <Text style={styles.title}>Google Tasks</Text>

      {!auth.configured && (
        <Text style={shared.muted}>
          Not set up yet. Add the Google client ID to app.json (see GOOGLE_SETUP.md).
        </Text>
      )}

      {auth.configured && !auth.account && (
        <View>
          <Text style={shared.muted}>
            Connect Google Tasks so anything you tell Gemini to add to a list shows up here.
            Your standing lists sync both ways. Day lists stay on the phone.
          </Text>
          <PrimaryButton
            label="Connect Google Tasks"
            onPress={auth.signIn}
            style={styles.connect}
          />
        </View>
      )}

      {auth.configured && auth.account && (
        <View>
          <Text style={shared.muted}>Connected as {auth.account}.</Text>
          <Text style={[shared.muted, sync.state === 'error' && styles.error]}>
            {sync.state === 'syncing'
              ? 'Syncing…'
              : sync.state === 'error'
                ? `Sync failed: ${sync.error}`
                : describeLastSync(sync.lastSyncAt)}
          </Text>
          <View style={shared.row}>
            <SmallButton label="Sync now" onPress={sync.syncNow} />
            <SmallButton label="Disconnect" onPress={auth.signOut} />
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginTop: 32,
    paddingTop: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
  },
  title: { fontSize: 15, fontWeight: '700', color: colors.ink, marginBottom: 6 },
  connect: { alignSelf: 'flex-start', marginTop: 4 },
  error: { color: colors.danger },
});
