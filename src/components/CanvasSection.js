import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, shared } from '../theme';
import { PrimaryButton, SmallButton } from './Buttons';

function describeLastSync(ts) {
  if (!ts) return 'Not synced yet.';
  const mins = Math.round((Date.now() - ts) / 60000);
  if (mins < 1) return 'Synced just now.';
  if (mins < 60) return `Synced ${mins} min ago.`;
  const hours = Math.round(mins / 60);
  return hours < 24 ? `Synced ${hours} hour${hours === 1 ? '' : 's'} ago.` : `Synced on ${new Date(ts).toLocaleDateString()}.`;
}

export default function CanvasSection({ auth, sync, courses }) {
  const [host, setHost] = useState('');
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);

  const connect = async () => {
    setBusy(true);
    const ok = await auth.connect(host, token);
    setBusy(false);
    if (ok) setToken('');
  };

  return (
    <View style={styles.section}>
      <Text style={styles.title}>Canvas</Text>

      {!auth.connected ? (
        <View>
          <Text style={shared.muted}>
            Pull your assignments into a School list with due dates. Submitted work is checked off
            automatically. In Canvas: Account → Settings → New Access Token.
          </Text>
          <TextInput
            style={[shared.input, styles.input]}
            value={host}
            onChangeText={setHost}
            placeholder="Canvas address, e.g. school.instructure.com"
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />
          <TextInput
            style={[shared.input, styles.input]}
            value={token}
            onChangeText={setToken}
            placeholder="Access token"
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
          />
          <PrimaryButton label={busy ? 'Checking…' : 'Connect Canvas'} onPress={busy ? () => {} : connect} style={styles.button} />
          {auth.error ? <Text style={styles.error}>{auth.error}</Text> : null}
        </View>
      ) : (
        <View>
          <Text style={shared.muted}>
            Connected as {auth.userName} at {auth.host.replace(/^https?:\/\//, '')}.
          </Text>
          <Text style={[shared.muted, sync.state === 'error' && styles.error]}>
            {sync.state === 'syncing' ? 'Syncing…' : sync.state === 'error' ? `Sync failed: ${sync.error}` : describeLastSync(sync.lastSyncAt)}
          </Text>
          {courses.length > 0 && (
            <View style={styles.courses}>
              {courses.map((c) => (
                <View key={c.id} style={[styles.courseRow, shared.hairline]}>
                  <Text style={styles.courseName} numberOfLines={1}>
                    {c.name}
                  </Text>
                  <Text style={styles.courseGrade}>
                    {c.score != null ? `${Math.round(c.score)}%${c.grade ? ` ${c.grade}` : ''}` : '—'}
                  </Text>
                </View>
              ))}
            </View>
          )}
          <View style={shared.row}>
            <SmallButton label="Sync now" onPress={sync.syncNow} />
            <SmallButton label="Disconnect" onPress={auth.disconnect} />
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 32, paddingTop: 20, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  title: { fontSize: 15, fontWeight: '700', color: colors.ink, marginBottom: 6 },
  input: { flex: 0, marginTop: 8 },
  button: { alignSelf: 'flex-start', marginTop: 10 },
  error: { color: colors.danger, fontSize: 13, marginTop: 6 },
  courses: { marginTop: 8, marginBottom: 6 },
  courseRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, gap: 12 },
  courseName: { flex: 1, fontSize: 14, color: colors.ink },
  courseGrade: { fontSize: 13, fontWeight: '600', color: colors.muted },
});
